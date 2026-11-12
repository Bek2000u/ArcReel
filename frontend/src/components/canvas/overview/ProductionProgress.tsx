import { useTranslation } from "react-i18next";

import { useProjectsStore } from "@/stores/projects-store";
import type { ProjectData } from "@/types";
import { episodeDisplayName } from "@/utils/episode-display";
import { episodeMediaStates, episodeVisualItems, scriptForEpisode, type MediaState } from "@/utils/episode-visuals";

const colors: Record<MediaState, string> = {
  current: "bg-primary",
  stale: "bg-warn",
  missing: "bg-muted",
};

const statuses: MediaState[] = ["current", "stale", "missing"];

export function ProductionProgress({ data }: { data: ProjectData }) {
  const { t } = useTranslation("dashboard");
  const scripts = useProjectsStore((state) => state.currentScripts);
  const ledger = data.episodes ?? [];
  const episodes = ledger.flatMap((episode) => {
    const items = episodeVisualItems(scriptForEpisode(episode, scripts));
    if (items.length === 0) return [];
    const board = episodeMediaStates(episode.storyboard_ids);
    const video = episodeMediaStates(episode.video_ids);
    return [{
      id: episode.episode,
      name: episodeDisplayName(ledger, episode.episode, t),
      items: items.map((item) => ({
        id: item.id,
        script: "current" as const,
        prompts: item.pending ? "missing" as const : "current" as const,
        storyboard: board(item.id, item.assets?.storyboard_image),
        video: video(item.id, item.assets?.video_clip),
      })),
    }];
  });
  const isReference = data.generation_mode === "reference_video";
  const itemKey = isReference ? "graph_unit_label" : "graph_shot_label";
  const rows = isReference ? (["script", "prompts", "video"] as const) : (["script", "prompts", "storyboard", "video"] as const);
  const items = episodes.flatMap((episode) => episode.items);
  const total = episodes.reduce((sum, episode) => sum + episode.items.length, 0);
  if (total === 0) return null;

  return (
    <section aria-label={t("graph_production")} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">{t("graph_production")}</h2>
        <span className="text-xs text-muted-foreground">{t(isReference ? "production_column_unit" : "production_column_shot")}</span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 @sm/canvas:gap-x-3">
        <div aria-hidden className="text-xs @sm/canvas:text-sm">
          {rows.map((row) => <div key={row} className="flex h-7 items-center">{t(`production_row_${row}`)}</div>)}
        </div>
        <div role="img" aria-label={t("graph_production")} className="relative min-w-0 overflow-x-auto scroll-fade-x">
          {rows.map((row) => (
            <div key={row} className="flex h-7 items-center gap-0.5">
              {episodes.flatMap(({ id, items }, group) => items.map((item, index) => (
                <span
                  key={`${id}:${item.id}`}
                  title={`${t(itemKey, { position: index + 1 })} · ${t(`production_status_${item[row]}`)}`}
                  className={`h-3 min-w-0.75 flex-1 rounded-xs ${colors[item[row]]}${group > 0 && index === 0 ? " ml-1" : ""}`}
                />
              )))}
            </div>
          ))}
        </div>
        <dl className="num text-right text-xs @sm/canvas:text-sm">
          {rows.map((row) => {
            const current = items.filter((item) => item[row] === "current").length;
            const stale = items.filter((item) => item[row] === "stale").length;
            return (
              <div key={row} className="flex h-7 items-center justify-end">
                <dt className="sr-only">{t(`production_row_${row}`)}</dt>
                <dd>
                  <span>{current}</span><span className="text-muted-foreground"> / {total}</span>
                  <span className="sr-only"> · {stale} {t("production_status_stale")}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <table className="sr-only">
        <caption>{t("graph_production")}</caption>
        <thead><tr><th scope="col">{t("film_workspace_catalog")}</th>{rows.map((row) => <th key={row} scope="col">{t(`production_row_${row}`)}</th>)}</tr></thead>
        <tbody>
          {episodes.flatMap(({ id, name, items }) => items.map((item, index) => (
            <tr key={`${id}:${item.id}`}>
              <th scope="row">{name} · {t(itemKey, { position: index + 1 })}</th>
              {rows.map((row) => <td key={row}>{t(`production_status_${item[row]}`)}</td>)}
            </tr>
          )))}
        </tbody>
      </table>
      <div aria-hidden className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
        {statuses.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-xs ${colors[status]}`} />{t(`production_status_${status}`)}
          </span>
        ))}
      </div>
    </section>
  );
}
