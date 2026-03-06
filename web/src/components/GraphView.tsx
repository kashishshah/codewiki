import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "../types";
import { KIND_COLORS, EDGE_COLORS } from "../constants";

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  contextNodeIds: string[];
  scopedPath: string | null;
  hiddenKinds: Set<string>;
  hiddenLanguages: Set<string>;
  minLines: number;
  hideTests: boolean;
  onSelectNode: (id: string) => void;
  onToggleContext: (id: string) => void;
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
  hiddenKinds,
  hiddenLanguages,
  minLines,
  hideTests,
  onSelectNode,
  onToggleContext,
}: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  // Refs for values that change frequently — avoid restarting simulation
  const selectedRef = useRef(selectedNodeId);
  selectedRef.current = selectedNodeId;
  const contextRef = useRef(contextNodeIds);
  contextRef.current = contextNodeIds;
  const onSelectRef = useRef(onSelectNode);
  onSelectRef.current = onSelectNode;
  const onToggleRef = useRef(onToggleContext);
  onToggleRef.current = onToggleContext;

  // Ref to hold D3 circle selection for style updates without re-render
  const circlesRef = useRef<d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown> | null>(
    null,
  );

  // Update circle strokes when selection/context changes (no simulation restart)
  useEffect(() => {
    if (!circlesRef.current) return;
    circlesRef.current
      .attr("stroke", (d) => {
        if (d.id === selectedNodeId) return "#fff";
        if (contextNodeIds.includes(d.id)) return "#22d3ee";
        return "none";
      })
      .attr("stroke-width", (d) => {
        if (d.id === selectedNodeId || contextNodeIds.includes(d.id)) return 3;
        return 0;
      });
  }, [selectedNodeId, contextNodeIds]);

  // Main simulation — only restarts when graph structure changes
  const buildSimulation = useCallback(() => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);
    const width = svgEl.clientWidth || 800;
    const height = svgEl.clientHeight || 600;

    svg.selectAll("*").remove();
    circlesRef.current = null;

    const visibleNodes = nodes.filter((n) => {
      if (n.kind === "file") return false;
      if (hiddenKinds.has(n.kind)) return false;
      if (n.language && hiddenLanguages.has(n.language)) return false;
      if (minLines > 0 && n.end_line - n.start_line < minLines) return false;
      if (
        hideTests &&
        (n.name.startsWith("test_") ||
          n.name.startsWith("Test") ||
          n.name === "tests" ||
          n.file_path.includes("/tests/") ||
          n.file_path.includes("/test/") ||
          n.file_path.endsWith("_test.py") ||
          n.file_path.endsWith("_test.exs") ||
          n.file_path.endsWith("_test.ex"))
      )
        return false;
      if (scopedPath && n.file_path !== scopedPath && !n.file_path.startsWith(scopedPath + "/"))
        return false;
      return true;
    });
    const nodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

    const edgeCount = new Map<string, number>();
    for (const e of visibleEdges) {
      edgeCount.set(e.from, (edgeCount.get(e.from) || 0) + 1);
      edgeCount.set(e.to, (edgeCount.get(e.to) || 0) + 1);
    }

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

    const n = simNodes.length;
    const chargeStrength = n > 200 ? -400 : n > 50 ? -300 : -200;
    const linkDist = n > 200 ? 150 : n > 50 ? 100 : 80;
    const collisionRadius = n > 200 ? 15 : 25;

    // Pre-compute layout silently so nodes don't visibly jitter on load
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
      )
      .alphaDecay(0.04)
      .velocityDecay(0.3)
      .stop();

    // Run simulation to completion synchronously
    const ticks = Math.ceil(
      Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
    );
    for (let i = 0; i < ticks; i++) simulation.tick();

    simulationRef.current = simulation;

    const g = svg.append("g");

    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "blur");
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

    // Track whether the current gesture is a drag vs a click
    const dragState = { dragged: false };

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
            dragState.dragged = false;
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            dragState.dragged = true;
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    const circles = node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => KIND_COLORS[d.kind] || "#78909c")
      .attr("filter", "url(#glow)")
      .attr("stroke", (d) => {
        if (d.id === selectedRef.current) return "#fff";
        if (contextRef.current.includes(d.id)) return "#22d3ee";
        return "none";
      })
      .attr("stroke-width", (d) => {
        if (d.id === selectedRef.current || contextRef.current.includes(d.id)) return 3;
        return 0;
      });

    circlesRef.current = circles;

    node
      .append("text")
      .text((d) => d.name)
      .attr("x", 14)
      .attr("y", 4)
      .attr("font-size", "11px")
      .attr("fill", "#6b7280");

    // Click handlers — use refs to avoid stale closures
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    node.on("click", (event, d) => {
      if (dragState.dragged) return;
      event.stopPropagation();
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        onSelectRef.current(d.id);
        clickTimer = null;
      }, 250);
    });
    node.on("dblclick", (event, d) => {
      if (dragState.dragged) return;
      event.stopPropagation();
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      onToggleRef.current(d.id);
    });

    // Render pre-computed positions immediately
    const updatePositions = () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as SimNode).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    };
    updatePositions();

    // Fit to viewport immediately
    if (simNodes.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const d of simNodes) {
        const x = d.x ?? 0,
          y = d.y ?? 0,
          r = d.radius;
        if (x - r < minX) minX = x - r;
        if (y - r < minY) minY = y - r;
        if (x + r > maxX) maxX = x + r;
        if (y + r > maxY) maxY = y + r;
      }
      const pad = 60;
      minX -= pad;
      minY -= pad;
      maxX += pad;
      maxY += pad;
      const bw = maxX - minX,
        bh = maxY - minY;
      if (bw > 0 && bh > 0) {
        const scale = Math.min(width / bw, height / bh, 2);
        const tx = (width - bw * scale) / 2 - minX * scale;
        const ty = (height - bh * scale) / 2 - minY * scale;
        svg.call(zoom.transform as never, d3.zoomIdentity.translate(tx, ty).scale(scale));
      }
    }

    // Restart simulation for drag interactions only
    simulation.on("tick", updatePositions).restart();

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, scopedPath, hiddenKinds, hiddenLanguages, minLines, hideTests]);

  useEffect(() => {
    const cleanup = buildSimulation();
    return () => {
      cleanup?.();
      simulationRef.current?.stop();
    };
  }, [buildSimulation]);

  return (
    <div className="w-full h-full bg-black">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
