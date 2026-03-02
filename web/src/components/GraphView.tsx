import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "../types";
import { KIND_COLORS, EDGE_COLORS, FILTERABLE_KINDS } from "../constants";

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  contextNodeIds: string[];
  scopedPath: string | null;
  onSelectNode: (id: string) => void;
  onToggleContext: (id: string) => void;
  onClearScope: () => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  kind: string;
  radius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  kind: string;
}

export function GraphView({
  nodes,
  edges,
  selectedNodeId,
  contextNodeIds,
  scopedPath,
  onSelectNode,
  onToggleContext,
  onClearScope,
}: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());

  const toggleKind = (kind: string) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const render = useCallback(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);
    const width = svgEl.clientWidth || 800;
    const height = svgEl.clientHeight || 600;

    svg.selectAll("*").remove();

    // Filter nodes: exclude files, hidden kinds, and apply file scope
    const visibleNodes = nodes.filter((n) => {
      if (n.kind === "file") return false;
      if (hiddenKinds.has(n.kind)) return false;
      if (scopedPath && n.file_path !== scopedPath && !n.file_path.startsWith(scopedPath + "/"))
        return false;
      return true;
    });
    const nodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

    // Compute connectivity (edge count per node)
    const edgeCount = new Map<string, number>();
    for (const e of visibleEdges) {
      edgeCount.set(e.from, (edgeCount.get(e.from) || 0) + 1);
      edgeCount.set(e.to, (edgeCount.get(e.to) || 0) + 1);
    }

    // Compute radius: base from lines of code, bonus from connectivity
    // Lines: clamp to [1, 200], map to [5, 16] via sqrt scale
    // Connectivity: each edge adds 0.5, capped at +6
    const computeRadius = (node: GraphNode) => {
      const lines = Math.max(1, node.end_line - node.start_line || 1);
      const lineRadius = 5 + Math.sqrt(Math.min(lines, 200) / 200) * 11;
      const connections = edgeCount.get(node.id) || 0;
      const connectBonus = Math.min(connections * 0.5, 6);
      return lineRadius + connectBonus;
    };

    const simNodes: SimNode[] = visibleNodes.map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      radius: computeRadius(n),
    }));

    const simLinks: SimLink[] = visibleEdges.map((e) => ({
      source: e.from as unknown as SimNode,
      target: e.to as unknown as SimNode,
      kind: e.kind,
    }));

    // Adaptive forces based on node count
    const n = simNodes.length;
    const chargeStrength = n > 200 ? -400 : n > 50 ? -300 : -200;
    const linkDist = n > 200 ? 150 : n > 50 ? 100 : 80;
    const collisionRadius = n > 200 ? 15 : 25;

    const simulation = d3
      .forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(linkDist),
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => d.radius + collisionRadius),
      );

    simulationRef.current = simulation;

    const g = svg.append("g");

    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        g.selectAll<SVGTextElement, SimNode>("text").attr(
          "opacity",
          event.transform.k > 0.5 ? 1 : 0,
        );
      });

    svg.call(zoom as never);

    const link = g
      .append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d) => EDGE_COLORS[d.kind] || "#334155")
      .attr("stroke-opacity", scopedPath ? 0.8 : 0.4)
      .attr("stroke-width", scopedPath ? 1.5 : 1)
      .attr("stroke-dasharray", (d) => (d.kind === "implements" ? "4,4" : "none"));

    const node = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => KIND_COLORS[d.kind] || "#78909c")
      .attr("filter", "url(#glow)")
      .attr("stroke", (d) => {
        if (d.id === selectedNodeId) return "#fff";
        if (contextNodeIds.includes(d.id)) return "#22d3ee";
        return "none";
      })
      .attr("stroke-width", (d) => {
        if (d.id === selectedNodeId || contextNodeIds.includes(d.id)) return 3;
        return 0;
      });

    node
      .append("text")
      .text((d) => d.name)
      .attr("x", 14)
      .attr("y", 4)
      .attr("font-size", "11px")
      .attr("fill", "#94a3b8");

    // Click handlers — delay single-click so double-click can cancel it
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    node.on("click", (_event, d) => {
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        onSelectNode(d.id);
        clickTimer = null;
      }, 250);
    });
    node.on("dblclick", (_event, d) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      onToggleContext(d.id);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [
    nodes,
    edges,
    selectedNodeId,
    contextNodeIds,
    scopedPath,
    hiddenKinds,
    onSelectNode,
    onToggleContext,
  ]);

  useEffect(() => {
    render();
    return () => {
      simulationRef.current?.stop();
    };
  }, [render]);

  const scopedName = scopedPath?.split("/").pop();

  return (
    <div className="w-full h-full bg-black">
      <svg ref={svgRef} className="w-full h-full" />

      {scopedPath && (
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur border border-white/[0.07] rounded-full text-xs text-slate-300">
            Viewing: {scopedName}
            <button onClick={onClearScope} className="text-slate-500 hover:text-slate-200 ml-1">
              ✕
            </button>
          </span>
        </div>
      )}

      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur border border-white/[0.07] rounded-lg p-1.5 flex flex-wrap gap-1 z-10">
        {FILTERABLE_KINDS.map((kind) => {
          const hidden = hiddenKinds.has(kind);
          return (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-opacity ${
                hidden ? "opacity-30" : "opacity-100"
              }`}
              title={hidden ? `Show ${kind}` : `Hide ${kind}`}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: KIND_COLORS[kind] }}
              />
              <span className="text-slate-400">{kind.charAt(0).toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur border border-white/[0.07] rounded p-2 text-xs flex flex-wrap gap-3">
        {Object.entries(KIND_COLORS).map(([kind, color]) => (
          <div key={kind} className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-400">{kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
