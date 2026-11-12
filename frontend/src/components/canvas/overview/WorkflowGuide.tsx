import { Position } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { FilmGraph, type FilmGraphNode } from "@/components/canvas/graphs/FilmGraph";
import { filmEdge } from "@/components/canvas/graphs/film-edge";

const stages = [
  { id: "source", x: 0, y: 112 },
  { id: "script", x: 180, y: 112 },
  { id: "assets", x: 360, y: 0 },
  { id: "storyboard", x: 360, y: 112 },
  { id: "video", x: 540, y: 112 },
  { id: "edit", x: 540, y: 224 },
] as const;

const edges = [
  filmEdge("source", "script", Position.Right, Position.Left),
  filmEdge("script", "assets", Position.Right, Position.Left),
  filmEdge("script", "storyboard", Position.Right, Position.Left),
  filmEdge("assets", "storyboard", Position.Bottom, Position.Top),
  filmEdge("assets", "video", Position.Right, Position.Top),
  filmEdge("storyboard", "video", Position.Right, Position.Left),
  filmEdge("video", "edit", Position.Bottom, Position.Top),
];

export function WorkflowGuide() {
  const { t } = useTranslation("dashboard");
  const nodes: FilmGraphNode[] = stages.map(({ id, x, y }) => ({
    id, type: "filmCard", width: 160, position: { x, y },
    data: { content: (
      <div className="min-h-23 space-y-1 rounded-lg border border-border bg-card p-2.5">
        <h3 className="text-sm font-semibold">{t(`graph_stage_${id}`)}</h3>
        <p className="text-xs text-muted-foreground">{t(`workflow_guide_${id}`)}</p>
      </div>
    ) },
  }));

  return (
    <section aria-label={t("workflow_guide_tab")} className="space-y-3">
      <h2 className="text-base font-semibold">{t("workflow_guide_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("workflow_guide_intro")}</p>
      <FilmGraph nodes={nodes} edges={edges} label={t("workflow_guide_tab")} />
      <p className="text-sm text-muted-foreground">{t("workflow_guide_reference_note")}</p>
    </section>
  );
}
