import { useCallback, useState } from "react";
import { ArrowUpRight, Film, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

import { EPISODE_VIEW_PARAM, WORKSPACE_ROUTE_EPISODES } from "@/app-routes";
import { ProjectThumbnail } from "@/components/canvas/shared/ProjectThumbnail";
import { PresentationPlayer } from "@/components/shared/PresentationPlayer";
import { useProjectsStore } from "@/stores/projects-store";
import type { EpisodeMeta } from "@/types";
import { episodeDisplayName } from "@/utils/episode-display";
import { episodeMediaStates, episodeVisualItems, scriptForEpisode, type EpisodeVisualItem } from "@/utils/episode-visuals";

function episodePath(id: number) {
  return `/${WORKSPACE_ROUTE_EPISODES}/${id}`;
}

function EpisodeCatalogCard({ projectName, episode, name, items, isReference }: {
  projectName: string;
  episode: EpisodeMeta;
  name: string;
  items: EpisodeVisualItem[];
  isReference: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const path = episodePath(episode.episode);
  const images = items.flatMap((item) => {
    const image = item.assets?.storyboard_image ?? item.assets?.video_thumbnail;
    return image ? [{ id: item.id, image }] : [];
  }).slice(0, 3);
  const duration = Math.round(episode.duration_seconds ?? 0);
  const time = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;
  const videos = episode.videos;
  const scriptSummary = isReference
    ? `${t("video_unit_count", { count: items.length })} · ${t("overview_meta_script_duration", { duration: time })}`
    : t("film_workspace_script_summary", { count: items.length, time });

  return (
    <article className="min-w-0 rounded-lg border border-border bg-card p-3">
      <Link href={path} aria-label={name} className="focus-ring relative block aspect-[2.45] overflow-hidden rounded-sm bg-muted">
        {images.length > 0 ? (
          <div className={`grid size-full gap-0.5 ${images.length > 1 ? "grid-cols-[2fr_1fr] grid-rows-2" : "grid-cols-1"}`}>
            {images.map(({ id, image }, index) => (
              <div key={id} className={`min-h-0 overflow-hidden ${index === 0 || images.length === 2 ? "row-span-2" : ""}`}>
                <ProjectThumbnail projectName={projectName} path={image} width={index === 0 ? 640 : 320} />
              </div>
            ))}
          </div>
        ) : (
          <span className="grid size-full place-content-center text-sm text-muted-foreground">{t("film_workspace_no_frames")}</span>
        )}
      </Link>
      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="min-w-0 text-sm font-semibold break-words">{name}</h2>
        {videos && videos.total > 0 && (
          <span className="num text-xs text-muted-foreground">{t("film_workspace_video_count", { current: videos.available - videos.stale, total: videos.total })}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {items.length > 0 ? scriptSummary : t("film_workspace_no_script")}
      </p>
      <div className="mt-2.5 flex flex-wrap justify-between gap-2 text-sm">
        <Link href={path} className="focus-ring inline-flex items-center gap-1 rounded-sm text-primary hover:underline">
          {t("film_workspace_open_episode")}<ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
        {items.length > 0 && (
          <Link href={`${path}?${EPISODE_VIEW_PARAM}=relationships`} className="focus-ring rounded-sm text-primary hover:underline">
            {t("episode_view_relationships")}
          </Link>
        )}
      </div>
    </article>
  );
}

function FilmEpisode({ projectName, episode, name, items, isReference, selectedId, onSelect }: {
  projectName: string;
  episode: EpisodeMeta;
  name: string;
  items: EpisodeVisualItem[];
  isReference: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation("dashboard");
  const videoState = episodeMediaStates(episode.video_ids);
  const selected = items.findIndex((item) => item.id === selectedId);
  const shot = items[selected];
  const itemKey = isReference ? "graph_unit_label" : "graph_shot_label";
  const videos = episode.videos;
  const activeStatus = shot ? videoState(shot.id, shot.assets?.video_clip) : "missing";
  const revealPreview = useCallback((preview: HTMLDivElement | null) => {
    if (!preview) return;
    preview.scrollIntoView({ block: "nearest" });
    preview.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-label={name} className="min-w-0 space-y-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold break-words">{name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {videos && items.length > 0
              ? t("film_workspace_video_count", { current: videos.available - videos.stale, total: videos.total })
              : items.length > 0 ? null : t("film_workspace_no_script")}
          </p>
        </div>
        <Link href={episodePath(episode.episode)} className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-primary hover:underline">
          {t("film_workspace_open_episode")}<ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5">
          {items.map((item, index) => {
            const state = videoState(item.id, item.assets?.video_clip);
            return (
              <button
                type="button"
                key={item.id}
                aria-label={t(itemKey, { position: index + 1 })}
                aria-pressed={selectedId === item.id}
                onClick={() => onSelect(item.id)}
                className="focus-ring overflow-hidden rounded-md border border-border bg-background text-left hover:border-primary aria-pressed:border-primary"
              >
                <span className="block aspect-video bg-muted">
                  <ProjectThumbnail projectName={projectName} path={item.assets?.video_thumbnail ?? item.assets?.storyboard_image} width={160} />
                </span>
                <span className="num flex items-center justify-between gap-1 px-1.5 py-1 text-xs">
                  <span>{index + 1}</span>
                  {state !== "missing" && <Play aria-label={t(`production_status_${state}`)} className={`size-3 ${state === "stale" ? "text-warn" : "text-good"}`} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {shot && (
        <div key={shot.id} ref={revealPreview} tabIndex={-1} role="group" aria-label={t(itemKey, { position: selected + 1 })} className="focus-ring max-w-78 rounded-md border border-border bg-background p-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <h3 className="font-medium">{t(itemKey, { position: selected + 1 })}</h3>
            {activeStatus === "stale" && <span className="text-xs text-warn">{t("production_status_stale")}</span>}
          </div>
          <div className="mt-2 aspect-video overflow-hidden rounded-sm bg-muted">
            {activeStatus !== "missing" && shot.assets?.video_clip ? (
              <PresentationPlayer projectName={projectName} resourceType={isReference ? "reference_videos" : "videos"} resourceId={shot.id} posterPath={shot.assets.video_thumbnail ?? shot.assets.storyboard_image} />
            ) : <ProjectThumbnail projectName={projectName} path={shot.assets?.storyboard_image} />}
          </div>
        </div>
      )}
    </section>
  );
}

export function FilmWorkspace({ projectName, mode, episodes }: {
  projectName: string;
  mode: "catalog" | "film";
  episodes: EpisodeMeta[];
}) {
  const { t } = useTranslation("dashboard");
  const scripts = useProjectsStore((state) => state.currentScripts);
  const isReference = useProjectsStore((state) => state.currentProjectData?.generation_mode === "reference_video");
  const [selection, setSelection] = useState<{ episode: number; item: string } | null>(null);
  if (episodes.length === 0) return (
    <div className="grid justify-items-center gap-2 p-6 text-sm text-muted-foreground">
      <Film aria-hidden className="size-5" />{t("overview_meta_no_episodes")}
    </div>
  );

  return (
    <div className={mode === "catalog" ? "grid gap-3 @2xl/canvas:grid-cols-2 @6xl/canvas:grid-cols-3" : "flex flex-col gap-3"}>
      {episodes.map((episode) => {
        const items = episodeVisualItems(scriptForEpisode(episode, scripts));
        const name = episodeDisplayName(episodes, episode.episode, t);
        return mode === "catalog" ? (
          <EpisodeCatalogCard key={episode.episode} projectName={projectName} episode={episode} items={items} name={name} isReference={isReference} />
        ) : (
          <FilmEpisode
            key={episode.episode}
            projectName={projectName}
            episode={episode}
            items={items}
            name={name}
            isReference={isReference}
            selectedId={selection?.episode === episode.episode ? selection.item : null}
            onSelect={(item) => setSelection((previous) => previous?.episode === episode.episode && previous.item === item ? null : { episode: episode.episode, item })}
          />
        );
      })}
    </div>
  );
}
