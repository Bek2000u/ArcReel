import {
  Background, Controls, Handle, Position, ReactFlow, useReactFlow,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "@xyflow/react/dist/style.css";
import "./film-graph.css";

export type FilmGraphNode = Node<{ content: ReactNode }, "filmCard">;

const sides = [Position.Left, Position.Right, Position.Top, Position.Bottom];

function FilmCard({ data }: NodeProps<FilmGraphNode>) {
  return (
    <>
      {sides.map((side) => (
        <Handle key={`in-${side}`} id={`in-${side}`} type="target" position={side} className="opacity-0" />
      ))}
      {data.content}
      {sides.map((side) => (
        <Handle key={`out-${side}`} id={`out-${side}`} type="source" position={side} className="opacity-0" />
      ))}
    </>
  );
}

const nodeTypes = { filmCard: FilmCard };
const fitViewOptions = { padding: 0.14, maxZoom: 1 };

function FocusNode({ id }: { id: string }) {
  const { getNode, getViewport, setCenter } = useReactFlow<FilmGraphNode>();
  useEffect(() => {
    const node = getNode(id);
    if (!node) return;
    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? 0;
    void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: Math.max(getViewport().zoom, 0.75), duration: 160,
    });
  }, [getNode, getViewport, id, setCenter]);
  return null;
}

export function FilmGraph({ nodes, edges, label, focus, tall = false }: {
  nodes: FilmGraphNode[];
  edges: Edge[];
  label: string;
  focus?: { id: string; revision: number } | null;
  tall?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <div data-film-graph className={`${tall ? "h-126 @5xl/canvas:h-148" : "h-90"} min-w-0 overflow-hidden rounded-xl border border-border bg-muted/20`}>
      <ReactFlow
        aria-label={label}
        ariaLabelConfig={{
          "controls.ariaLabel": label,
          "controls.zoomIn.ariaLabel": t("chat_md_zoom_in"),
          "controls.zoomOut.ariaLabel": t("chat_md_zoom_out"),
          "controls.fitView.ariaLabel": t("graph_fit_view"),
        }}
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag
        minZoom={0.05}
        maxZoom={1.75}
        fitView
        fitViewOptions={fitViewOptions}
      >
        <Background className="opacity-45" />
        <Controls showInteractive={false} fitViewOptions={fitViewOptions} />
        {focus && <FocusNode key={focus.revision} id={focus.id} />}
      </ReactFlow>
    </div>
  );
}
