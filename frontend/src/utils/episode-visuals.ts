import type { EpisodeArtifactIds, EpisodeMeta, EpisodeScript } from "@/types";
import type { ReferenceVideoUnit } from "@/types/reference-video";

import { itemExcerpt } from "./episode-item";
import { extractMentions, normalizeAssetName } from "./reference-mentions";
import { getScriptItemId, getScriptItems } from "./script-shape";

export function scriptForEpisode(episode: EpisodeMeta, scripts: Readonly<Record<string, EpisodeScript>>) {
  if (episode.script_status && episode.script_status !== "generated") return undefined;
  const file = episode.script_file;
  return file ? scripts[file.replace(/^scripts\//, "")] ?? scripts[file] : undefined;
}

export function episodeVisualItems(script: EpisodeScript | null | undefined) {
  if (!script) return [];
  const { video_units: units } = script as EpisodeScript & { video_units?: ReferenceVideoUnit[] };
  if (Array.isArray(units)) {
    return units.map((unit) => ({
      id: unit.unit_id,
      duration: unit.duration_seconds,
      assets: unit.generated_assets,
      excerpt: itemExcerpt({ ...unit }),
      pending: unit.pending_authoring === true,
      references: [...new Set(extractMentions(unit.text).map(normalizeAssetName).filter(Boolean))],
    }));
  }
  return getScriptItems(script, script.content_mode).map((item) => ({
    id: getScriptItemId(item, script.content_mode),
    duration: item.duration_seconds,
    assets: item.generated_assets,
    excerpt: itemExcerpt({ ...item }),
    pending: item.pending_authoring === true,
    references: [...new Set([
      ...("characters_in_scene" in item ? item.characters_in_scene : []),
      ...("characters_in_segment" in item ? item.characters_in_segment : []),
      ...("characters_in_shot" in item ? item.characters_in_shot ?? [] : []),
      ...(item.scenes ?? []),
      ...(item.props ?? []),
      ...("products_in_shot" in item ? item.products_in_shot ?? [] : []),
    ].map(normalizeAssetName).filter(Boolean))],
  }));
}

export type EpisodeVisualItem = ReturnType<typeof episodeVisualItems>[number];
export type MediaState = "current" | "stale" | "missing";

export function episodeMediaStates(ids: EpisodeArtifactIds | undefined) {
  const states = new Map<string, MediaState>();
  for (const id of ids?.current_ids ?? []) states.set(id, "current");
  for (const id of ids?.stale_ids ?? []) states.set(id, "stale");
  return (id: string, path: string | null | undefined): MediaState =>
    ids ? states.get(id) ?? "missing" : path ? "current" : "missing";
}
