import { useState } from "react";
import { ArrowUpRight, Film, Image, Play } from "lucide-react";
import { Position } from "@xyflow/react";
import { cn } from "cn";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { WORKSPACE_ROUTE_CHARACTERS, WORKSPACE_ROUTE_PRODUCTS, WORKSPACE_ROUTE_PROPS, WORKSPACE_ROUTE_SCENES } from "@/app-routes";
import { FilmGraph, type FilmGraphNode } from "@/components/canvas/graphs/FilmGraph";
import { filmEdge } from "@/components/canvas/graphs/film-edge";
import { refreshAfterWrite } from "@/components/canvas/shared/refreshAfterWrite";
import { ProjectThumbnail } from "@/components/canvas/shared/ProjectThumbnail";
import { VersionTimeMachine } from "@/components/canvas/timeline/VersionTimeMachine";
import { PresentationPlayer } from "@/components/shared/PresentationPlayer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isResourceBusy, useActiveResourceIds } from "@/stores/tasks-store";
import type { ProjectData } from "@/types";
import type { AssetKind } from "@/types/reference-video";
import type { EpisodeScript } from "@/types/script";
import { episodeMediaStates, episodeVisualItems } from "@/utils/episode-visuals";
import { buildMentionLookup, formatReferenceName, normalizeAssetName, resolveCharacterForm } from "@/utils/reference-mentions";

const gallery: Record<AssetKind, string> = {
  character: WORKSPACE_ROUTE_CHARACTERS,
  scene: WORKSPACE_ROUTE_SCENES,
  prop: WORKSPACE_ROUTE_PROPS,
  product: WORKSPACE_ROUTE_PRODUCTS,
};

interface Reference {
  name: string;
  kind: AssetKind | undefined;
  path: string | undefined;
}

function assetByName<T>(assets: Record<string, T> | undefined, name: string): T | undefined {
  const entry = Object.entries(assets ?? {}).find(([key]) => normalizeAssetName(key) === name);
  return entry?.[1];
}

function referencePath(project: ProjectData, name: string, kind: AssetKind | undefined) {
  switch (kind) {
    case "character": return resolveCharacterForm(project.characters, name)?.asset.character_sheet;
    case "scene": return assetByName(project.scenes, name)?.scene_sheet;
    case "prop": return assetByName(project.props, name)?.prop_sheet;
    case "product": return assetByName(project.products, name)?.product_sheet;
  }
}

export function ShotRelationships({ projectName, projectData, episode, script, onViewUnit }: {
  projectName: string;
  projectData: ProjectData;
  episode: number;
  script: EpisodeScript;
  onViewUnit: (id: string) => void;
}) {
  const { t } = useTranslation(["dashboard", "common"]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"sequence" | "references">("sequence");
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; revision: number } | null>(null);
  const shots = episodeVisualItems(script);
  const selected = Math.max(0, shots.findIndex((shot) => shot.id === selectedId));
  const shot = shots[selected];
  const isReference = projectData.generation_mode === "reference_video";
  const resourceType = isReference ? "reference_videos" : "videos";
  const occupied = useActiveResourceIds("video", projectName);
  const itemLabel = (position: number) => t(isReference ? "graph_unit_label" : "graph_shot_label", { position });
  const label = t(mode === "sequence" ? "episode_graph_sequence" : "episode_graph_references");
  if (!shot) return <p className="p-6 text-sm text-muted-foreground">{t("graph_empty_shots")}</p>;

  const lookup = buildMentionLookup(projectData);
  const usage = new Map<string, number>();
  for (const item of shots) for (const name of item.references) usage.set(name, (usage.get(name) ?? 0) + 1);
  const allReferences = [...usage.keys()];
  const activeReference = selectedReference && usage.has(selectedReference) ? selectedReference : shot.references[0] ?? allReferences[0];
  const references: Reference[] = shot.references.map((name) => {
    const kind = lookup[name];
    return { name, kind, path: referencePath(projectData, name, kind) };
  });
  const columns = Math.max(3, Math.ceil(Math.sqrt(shots.length * 1.2)));
  const referenceColumns = Math.min(5, columns);
  const shotsY = mode === "sequence" ? Math.ceil(references.length / referenceColumns) * 65 + 20 : 0;
  const videoState = episodeMediaStates(projectData.episodes?.find((entry) => entry.episode === episode)?.video_ids);
  const shotNodes: FilmGraphNode[] = shots.map((neighbor, index) => {
    const current = index === selected;
    const poster = neighbor.assets?.video_thumbnail ?? neighbor.assets?.storyboard_image;
    const state = videoState(neighbor.id, neighbor.assets?.video_clip);
    const related = mode === "references" && activeReference && neighbor.references.includes(activeReference);
    const dimmed = mode === "references" && activeReference && !related && !current;
    return {
      id: neighbor.id,
      type: "filmCard",
      width: 140,
      position: { x: (index % columns) * 162, y: shotsY + Math.floor(index / columns) * 108 },
      data: { content: (
        <button type="button" aria-label={itemLabel(index + 1)} aria-pressed={current} onClick={() => setSelectedId(neighbor.id)} className={cn(
          "w-full overflow-hidden rounded-lg border bg-card text-left text-card-foreground outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring",
          current ? "border-primary ring-1 ring-primary" : related ? "border-primary/65" : "border-border",
        )}>
          <div className={cn("h-14 bg-muted", dimmed && "opacity-50")}><ProjectThumbnail projectName={projectName} path={poster} /></div>
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-sm">
            <span className="font-semibold">{itemLabel(index + 1)}</span>
            {state !== "missing" ? (
              <Play aria-label={t(`production_status_${state}`)} className={cn("size-3", state === "stale" ? "text-warn" : "text-good")} />
            ) : <span className="text-xs text-muted-foreground">{t("duration_seconds_value_text", { value: neighbor.duration })}</span>}
          </div>
        </button>
      ) },
    };
  });
  const refNodes: FilmGraphNode[] = mode === "sequence" ? references.map((ref, index) => {
    const name = formatReferenceName(ref.name);
    const rowStart = Math.floor(index / referenceColumns) * referenceColumns;
    const rowSize = Math.min(referenceColumns, references.length - rowStart);
    const content = (
      <>
        <div className="size-8 shrink-0 overflow-hidden rounded-sm bg-muted"><ProjectThumbnail projectName={projectName} path={ref.path} width={160} /></div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium" title={name}>{name}</div>
          <div className="truncate text-xs text-muted-foreground">{t(ref.kind ? `graph_ref_${ref.kind}` : "graph_ref_missing")}</div>
        </div>
      </>
    );
    const className = "flex w-full items-center gap-2 rounded-md border border-border bg-card p-1.5 text-card-foreground";
    return {
      id: `reference:${ref.name}`,
      type: "filmCard",
      width: 149,
      position: { x: ((columns - rowSize) / 2 + index % referenceColumns) * 162, y: rowStart / referenceColumns * 65 },
      data: { content: ref.kind ? (
        <Link href={`/${gallery[ref.kind]}`} className={`${className} hover:border-primary focus-visible:ring-2 focus-visible:ring-ring`}>{content}</Link>
      ) : <div className={className}>{content}</div> },
    };
  }) : [];
  const edges = mode === "sequence" ? [
    ...shotNodes.slice(1).map((node, index) => (index + 1) % columns === 0
      ? filmEdge(shotNodes[index].id, node.id, Position.Bottom, Position.Top)
      : filmEdge(shotNodes[index].id, node.id, Position.Right, Position.Left)),
    ...refNodes.map((node) => filmEdge(node.id, shot.id, Position.Bottom, Position.Top, true)),
  ] : [];
  const selectedLabel = itemLabel(selected + 1);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 [scrollbar-gutter:stable]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          aria-label={t("episode_view_relationships")}
          size="sm"
          variant="outline"
          spacing={0}
          value={[mode]}
          onValueChange={([next]) => {
            if (next !== "sequence" && next !== "references") return;
            setMode(next);
            setFocus(null);
          }}
        >
          <ToggleGroupItem value="sequence">{t("episode_graph_sequence")}</ToggleGroupItem>
          <ToggleGroupItem value="references">{t("episode_graph_references")}</ToggleGroupItem>
        </ToggleGroup>
        <Select value={shot.id} onValueChange={(value) => {
          if (!value) return;
          setSelectedId(value);
          setFocus((previous) => ({ id: value, revision: (previous?.revision ?? 0) + 1 }));
        }}>
          <SelectTrigger aria-label={t("graph_choose_shot")} className="max-w-72"><SelectValue>{selectedLabel}</SelectValue></SelectTrigger>
          <SelectContent>
            {shots.map((item, index) => <SelectItem value={item.id} key={item.id}>{itemLabel(index + 1)}{item.excerpt ? ` · ${item.excerpt}` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => onViewUnit(shot.id)}>
          {t("graph_open_shot")}<ArrowUpRight aria-hidden data-icon="inline-end" />
        </Button>
      </div>
      <div className="grid min-w-0 items-start gap-3 @4xl/canvas:grid-cols-[minmax(0,1fr)_16rem] @6xl/canvas:grid-cols-[minmax(0,1fr)_19rem]">
        <div className={cn("grid min-w-0 items-start gap-2", mode === "references" && "@5xl/canvas:grid-cols-[9rem_minmax(0,1fr)]")}>
          {mode === "references" && (
            <section aria-label={t("episode_graph_references")} className="relative flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-lg border border-border bg-card p-2 @5xl/canvas:max-h-148 @5xl/canvas:flex-col @5xl/canvas:flex-nowrap">
              {allReferences.length > 0 ? allReferences.map((name) => {
                const kind = lookup[name];
                return (
                  <button key={name} type="button" aria-pressed={name === activeReference} onClick={() => setSelectedReference(name)} className="focus-ring flex shrink-0 items-center gap-1.5 rounded-md border border-border px-1.5 py-1 text-left text-xs hover:border-primary aria-pressed:border-primary">
                    <span className="size-7 shrink-0 overflow-hidden rounded-sm bg-muted"><ProjectThumbnail projectName={projectName} path={referencePath(projectData, name, kind)} width={160} /></span>
                    <span className="min-w-0 break-words">{formatReferenceName(name)} <span className="num text-muted-foreground">· {usage.get(name)}</span></span>
                  </button>
                );
              }) : <p className="text-xs text-muted-foreground">{t("episode_graph_no_references")}</p>}
            </section>
          )}
          <FilmGraph key={mode} nodes={[...refNodes, ...shotNodes]} edges={edges} label={label} focus={focus} tall />
        </div>
        <section key={shot.id} aria-label={selectedLabel} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Film aria-hidden className="size-4" />{selectedLabel}</h2>
            <VersionTimeMachine
              projectName={projectName}
              resourceType={resourceType}
              resourceId={shot.id}
              onRestore={() => refreshAfterWrite(projectName, t)}
              busy={occupied.has(shot.id)}
              checkBusy={() => isResourceBusy("video", projectName, shot.id)}
            />
          </div>
          {shot.assets?.video_clip && videoState(shot.id, shot.assets.video_clip) !== "missing" ? (
            <div className="aspect-video overflow-hidden rounded-md bg-muted">
              <PresentationPlayer projectName={projectName} resourceType={resourceType} resourceId={shot.id} posterPath={shot.assets.video_thumbnail ?? shot.assets.storyboard_image} />
            </div>
          ) : (
            <div className="aspect-video overflow-hidden rounded-md bg-muted">
              <ProjectThumbnail projectName={projectName} path={shot.assets?.storyboard_image} />
            </div>
          )}
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Image aria-hidden className="size-4" />{t("graph_reference_count", { total: references.length })}</p>
        </section>
      </div>
    </div>
  );
}
