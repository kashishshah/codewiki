import { useState, useRef, useEffect } from "react";
import { useGraph, useNodeDetail } from "./hooks/useGraph";
import { useChat } from "./hooks/useChat";
import { searchNodes } from "./api";
import { KIND_COLORS, FILTERABLE_KINDS } from "./constants";
import type { GraphEdge } from "./types";
import { FileTree } from "./components/FileTree";
import { GraphView } from "./components/GraphView";
import { CodePanel } from "./components/CodePanel";
import { ChatPanel } from "./components/ChatPanel";

// Default: only show functions, hide everything else
const DEFAULT_HIDDEN = new Set(FILTERABLE_KINDS.filter((k) => k !== "function"));

function App() {
  const { data, loading, error } = useGraph();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextNodeIds, setContextNodeIds] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codePanelOpen, setCodePanelOpen] = useState(true);
  const [scopedPath, setScopedFilePath] = useState<string | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set(DEFAULT_HIDDEN));
  const [minLines, setMinLines] = useState(0);
  const [hideTests, setHideTests] = useState(true);
  const { detail } = useNodeDetail(selectedNodeId);
  const chat = useChat();

  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id);
  };

  const toggleContext = (id: string) => {
    setContextNodeIds((prev) =>
      prev.includes(id) ? prev.filter((nodeId) => nodeId !== id) : [...prev, id],
    );
  };

  const toggleKind = (kind: string) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const addScopedWithDependencies = () => {
    if (!scopedPath || !data) return;
    const scopedNodeIds = data.nodes
      .filter(
        (n) =>
          n.kind !== "file" &&
          (n.file_path === scopedPath || n.file_path.startsWith(scopedPath + "/")),
      )
      .map((n) => n.id);
    const allIds = collectDependencies(scopedNodeIds, data.edges, 2);
    setContextNodeIds((prev) => {
      const combined = new Set(prev);
      for (const id of allIds) combined.add(id);
      return Array.from(combined);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Indexing codebase...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        <p>Failed to load graph: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 relative min-h-0">
        {/* Graph fills the entire area */}
        <GraphView
          nodes={data.nodes}
          edges={data.edges}
          selectedNodeId={selectedNodeId}
          contextNodeIds={contextNodeIds}
          scopedPath={scopedPath}
          hiddenKinds={hiddenKinds}
          minLines={minLines}
          hideTests={hideTests}
          onSelectNode={handleSelectNode}
          onToggleContext={toggleContext}
        />

        {/* Sidebar overlay — transparent */}
        <div
          className={`absolute left-0 top-0 bottom-0 z-10 flex flex-col transition-all ${
            sidebarOpen ? "w-64" : "w-10"
          } bg-black/50 backdrop-blur-xl border-r border-white/[0.08]`}
        >
          <div className="p-2 border-b border-white/[0.08] flex items-center justify-between shrink-0">
            {sidebarOpen && (
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider px-1">
                Files
              </h2>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 text-slate-400 hover:text-slate-200 text-sm"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? "\u25C0" : "\u25B6"}
            </button>
          </div>
          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto">
              <FileTree
                entries={data.file_tree}
                onSelectFile={(path, isDir) => {
                  setScopedFilePath((prev) => (prev === path ? null : path));
                  if (!isDir) setSelectedNodeId(path);
                }}
              />
            </div>
          )}
        </div>

        {/* Search bar + scope chip overlay */}
        <div
          className="absolute top-3 z-20 flex flex-col gap-2"
          style={{ left: sidebarOpen ? "17.5rem" : "3.5rem", maxWidth: "24rem" }}
        >
          <SearchBar
            onSelect={handleSelectNode}
            hiddenKinds={hiddenKinds}
            onToggleKind={toggleKind}
            minLines={minLines}
            onMinLinesChange={setMinLines}
            hideTests={hideTests}
            onToggleHideTests={() => setHideTests((v) => !v)}
          />
          {scopedPath && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/60 backdrop-blur border border-white/[0.07] rounded-full text-xs text-slate-300">
                Viewing: {scopedPath.split("/").pop()}
                <button
                  onClick={() => setScopedFilePath(null)}
                  className="text-slate-500 hover:text-slate-200 ml-1"
                >
                  {"\u2715"}
                </button>
              </span>
              <button
                onClick={addScopedWithDependencies}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-900/40 backdrop-blur border border-cyan-700/50 rounded-full text-xs text-cyan-300 hover:bg-cyan-900/60 transition-colors"
                title="Add all nodes in this folder plus their dependencies (2 hops) to chat context"
              >
                + Add with deps
              </button>
            </div>
          )}
        </div>

        {/* Code panel overlay — transparent */}
        {selectedNodeId && (
          <div
            className={`absolute right-0 top-0 bottom-0 z-10 flex flex-col transition-all ${
              codePanelOpen ? "w-[32rem]" : "w-10"
            } bg-black/50 backdrop-blur-xl border-l border-white/[0.08]`}
          >
            <div className="p-2 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              {codePanelOpen && (
                <span className="text-sm font-semibold text-slate-300 truncate px-1">
                  {detail?.name || "Code"}
                </span>
              )}
              <button
                onClick={() => setCodePanelOpen(!codePanelOpen)}
                className="p-1 text-slate-400 hover:text-slate-200 text-sm"
                title={codePanelOpen ? "Collapse panel" : "Expand panel"}
              >
                {codePanelOpen ? "\u25B6" : "\u25C0"}
              </button>
            </div>
            {codePanelOpen && (
              <div className="flex-1 overflow-y-auto">
                <CodePanel
                  detail={detail}
                  isContext={contextNodeIds.includes(selectedNodeId)}
                  onToggleContext={() => toggleContext(selectedNodeId)}
                  onClose={() => setSelectedNodeId(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* Chat overlay — floating at bottom-right */}
        <div
          className="absolute bottom-4 right-4 z-30"
          style={{ width: chatOpen ? "36rem" : "auto" }}
        >
          {chatOpen ? (
            <div className="bg-black/60 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              <ChatPanel
                chat={chat}
                contextNodeIds={contextNodeIds}
                nodes={data.nodes}
                onRemoveContext={(id) =>
                  setContextNodeIds((prev) => prev.filter((nodeId) => nodeId !== id))
                }
                onClearContext={() => setContextNodeIds([])}
                onClose={() => setChatOpen(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="px-4 py-2 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-full shadow-lg shadow-black/30 hover:bg-black/70 transition-colors"
            >
              <span>Chat</span>
              {contextNodeIds.length > 0 && (
                <span className="px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/25 rounded-full text-xs text-cyan-400">
                  {contextNodeIds.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchBar({
  onSelect,
  hiddenKinds,
  onToggleKind,
  minLines,
  onMinLinesChange,
  hideTests,
  onToggleHideTests,
}: {
  onSelect: (id: string) => void;
  hiddenKinds: Set<string>;
  onToggleKind: (kind: string) => void;
  minLines: number;
  onMinLinesChange: (v: number) => void;
  hideTests: boolean;
  onToggleHideTests: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    window.addEventListener("pointerdown", handler, true);
    return () => window.removeEventListener("pointerdown", handler, true);
  }, [filterOpen]);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const nodes = await searchNodes(q);
      setResults(nodes.slice(0, 10));
      setOpen(true);
    } catch {
      setResults([]);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search symbols..."
          className="w-full px-3 py-1.5 bg-black/40 backdrop-blur-xl border border-white/[0.1] rounded-full text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-black/80 backdrop-blur-xl border border-white/[0.07] rounded shadow-lg z-50 max-h-60 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r.id);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/[0.05] text-sm flex items-center gap-2"
              >
                <KindBadge kind={r.kind} />
                <span className="text-slate-200">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setFilterOpen((prev) => !prev)}
          className={`px-3 py-1.5 bg-black/40 backdrop-blur-xl border rounded-full text-sm text-slate-400 hover:text-slate-200 transition-colors ${
            hiddenKinds.size > 0 || minLines > 0 ? "border-blue-500/50" : "border-white/[0.1]"
          }`}
          title="Filter node kinds"
        >
          <span className="flex items-center gap-1.5">
            Filter
            {hiddenKinds.size > 0 && (
              <span className="text-xs text-blue-400">{hiddenKinds.size}</span>
            )}
          </span>
        </button>
        {filterOpen && (
          <div className="absolute top-full right-0 mt-1 bg-black/80 backdrop-blur-xl border border-white/[0.07] rounded-lg shadow-lg z-50 p-2 min-w-[200px]">
            {FILTERABLE_KINDS.map((kind) => {
              const hidden = hiddenKinds.has(kind);
              return (
                <label
                  key={kind}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.05] rounded cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => onToggleKind(kind)}
                    className="accent-blue-500"
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: KIND_COLORS[kind] }}
                  />
                  <span className={`text-slate-300 ${hidden ? "line-through opacity-50" : ""}`}>
                    {kind}
                  </span>
                </label>
              );
            })}
            <div className="border-t border-white/[0.06] mt-1.5 pt-2 px-2 space-y-2">
              <label className="flex items-center gap-2 py-0.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={hideTests}
                  onChange={onToggleHideTests}
                  className="accent-blue-500"
                />
                <span className="text-slate-300">Hide tests</span>
              </label>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    Min lines
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">{minLines}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={minLines}
                  onChange={(e) => onMinLinesChange(Number(e.target.value))}
                  className="w-full h-1 accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                  <span>0</span>
                  <span>50+</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono"
      style={{ backgroundColor: KIND_COLORS[kind] || "#78909c", color: "#fff" }}
    >
      {kind.charAt(0).toUpperCase()}
    </span>
  );
}

function collectDependencies(seedIds: string[], edges: GraphEdge[], maxDepth: number): Set<string> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.kind === "contains") continue;
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    if (!adj.has(e.to)) adj.set(e.to, new Set());
    adj.get(e.from)!.add(e.to);
    adj.get(e.to)!.add(e.from);
  }

  const visited = new Set<string>(seedIds);
  let frontier = [...seedIds];

  for (let depth = 0; depth < maxDepth; depth++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      const neighbors = adj.get(nodeId);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  return visited;
}

export default App;
