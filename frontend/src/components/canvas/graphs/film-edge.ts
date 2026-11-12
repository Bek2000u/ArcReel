import { MarkerType, type Edge, type Position } from "@xyflow/react";

export function filmEdge(source: string, target: string, from: Position, to: Position, highlighted = false): Edge {
  const color = highlighted ? "var(--primary)" : "var(--muted-foreground)";
  return {
    id: `${source}→${target}`,
    source,
    target,
    sourceHandle: `out-${from}`,
    targetHandle: `in-${to}`,
    type: "smoothstep",
    style: { stroke: color, strokeWidth: highlighted ? 2 : 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 15, height: 15 },
  };
}
