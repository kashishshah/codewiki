import { useState, useEffect } from "react";
import { useGraph, useNodeDetail } from "./hooks/useGraph";
import { useChat } from "./hooks/useChat";
import { fetchConfig } from "./api";
import type { AppConfig } from "./api";
import { KIND_COLORS } from "./constants";
import type { GraphEdge, GraphNode } from "./types";
import { FileTree } from "./components/FileTree";
import { GraphView } from "./components/GraphView";
import { CodePanel } from "./components/CodePanel";
import { ChatPanel } from "./components/ChatPanel";
import { SearchBar } from "./components/SearchBar";
import { ChevronLeft, ChevronRight, ExpandIcon, ShrinkIcon, ChatIcon } from "./components/Icons";

function App() {
  const { data, loading, error } = useGraph();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextNodeIds, setContextNodeIds] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codePanelOpen, setCodePanelOpen] = useState(true);
  const [codePanelExpanded, setCodePanelExpanded] = useState(false);
  const [scopedPath, setScopedFilePath] = useState<string | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(
    new Set(["struct", "enum", "trait", "impl", "module", "constant", "type_alias", "class"]),
  );
  const [hiddenLanguages, setHiddenLanguages] = useState<Set<string>>(new Set());
  const [minLines, setMinLines] = useState(10);
  const [hideTests, setHideTests] = useState(true);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const { detail } = useNodeDetail(selectedNodeId);
  const chat = useChat();

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig({ cli_backend: false }));
  }, []);

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

  const toggleLanguage = (lang: string) => {
    setHiddenLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  };

  const detectedLanguages = data
    ? [...new Set(data.nodes.map((n: GraphNode) => n.language).filter(Boolean))]
    : [];

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
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" className="mx-auto mb-5">
            <g fill="none" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="16" cy="16" r="4" stroke="#6b8db5" opacity="0.6">
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="34" cy="14" r="3" stroke="#7ba386" opacity="0.6">
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="2s"
                  begin="0.3s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="26" cy="34" r="3.5" stroke="#9882b5" opacity="0.6">
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="2s"
                  begin="0.6s"
                  repeatCount="indefinite"
                />
              </circle>
              <line x1="20" y1="16" x2="31" y2="14" stroke="#6b8db5" opacity="0.25">
                <animate
                  attributeName="opacity"
                  values="0.25;0.5;0.25"
                  dur="2s"
                  begin="0.15s"
                  repeatCount="indefinite"
                />
              </line>
              <line x1="18" y1="19" x2="24" y2="31" stroke="#9882b5" opacity="0.25">
                <animate
                  attributeName="opacity"
                  values="0.25;0.5;0.25"
                  dur="2s"
                  begin="0.45s"
                  repeatCount="indefinite"
                />
              </line>
              <line x1="33" y1="17" x2="28" y2="31" stroke="#7ba386" opacity="0.25">
                <animate
                  attributeName="opacity"
                  values="0.25;0.5;0.25"
                  dur="2s"
                  begin="0.75s"
                  repeatCount="indefinite"
                />
              </line>
            </g>
          </svg>
          <p className="text-sm text-slate-500 tracking-wide">Indexing codebase</p>
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
        <GraphView
          nodes={data.nodes}
          edges={data.edges}
          selectedNodeId={selectedNodeId}
          contextNodeIds={contextNodeIds}
          scopedPath={scopedPath}
          hiddenKinds={hiddenKinds}
          hiddenLanguages={hiddenLanguages}
          minLines={minLines}
          hideTests={hideTests}
          onSelectNode={setSelectedNodeId}
          onToggleContext={toggleContext}
        />

        {/* Sidebar */}
        <div
          className="absolute left-0 top-0 bottom-0 z-10 flex flex-col panel-transition bg-black/50 backdrop-blur-xl border-r border-white/[0.08]"
          style={{ width: sidebarOpen ? "16rem" : "2.5rem" }}
        >
          <div className="p-2 border-b border-white/[0.08] flex items-center justify-between shrink-0">
            {sidebarOpen && (
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">
                Files
              </h2>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
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

        {/* Search + scope */}
        <div
          className="absolute top-3 z-20 flex flex-col gap-2 panel-transition"
          style={{
            left: sidebarOpen ? "17.5rem" : "3.5rem",
            right:
              selectedNodeId && codePanelOpen ? (codePanelExpanded ? "1rem" : "33rem") : "1rem",
            maxWidth: "42rem",
          }}
        >
          <SearchBar
            onSelect={setSelectedNodeId}
            hiddenKinds={hiddenKinds}
            onToggleKind={toggleKind}
            hiddenLanguages={hiddenLanguages}
            onToggleLanguage={toggleLanguage}
            detectedLanguages={detectedLanguages}
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

        {/* Legend */}
        <div
          className="absolute bottom-3 z-10 panel-transition"
          style={{
            right:
              selectedNodeId && codePanelOpen ? (codePanelExpanded ? "auto" : "33rem") : "1rem",
          }}
        >
          <div className="flex items-center gap-3 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full border border-white/[0.05]">
            {Object.entries(KIND_COLORS).map(([kind, color]) => (
              <div key={kind} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 4px ${color}40`,
                  }}
                />
                <span className="text-[10px] text-slate-600">{kind}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code panel */}
        {selectedNodeId && (
          <div
            className={`absolute right-0 top-0 bottom-0 flex flex-col panel-transition bg-black/50 backdrop-blur-xl border-l border-white/[0.08] ${codePanelExpanded ? "z-40" : "z-10"}`}
            style={{
              width: codePanelOpen
                ? codePanelExpanded
                  ? `calc(100% - ${sidebarOpen ? "16rem" : "2.5rem"})`
                  : "32rem"
                : "2.5rem",
            }}
          >
            <div className="p-2 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              {codePanelOpen && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-slate-300 truncate px-1">
                    {detail?.name || "Code"}
                  </span>
                  <button
                    onClick={() => setCodePanelExpanded(!codePanelExpanded)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors shrink-0"
                    title={codePanelExpanded ? "Shrink panel" : "Expand to full screen"}
                  >
                    {codePanelExpanded ? <ShrinkIcon /> : <ExpandIcon />}
                  </button>
                </div>
              )}
              <button
                onClick={() => setCodePanelOpen(!codePanelOpen)}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
                title={codePanelOpen ? "Collapse panel" : "Expand panel"}
              >
                {codePanelOpen ? <ChevronRight /> : <ChevronLeft />}
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

        {/* Chat */}
        <div
          className="absolute z-50 transition-all duration-200"
          style={
            chatOpen && chatExpanded
              ? {
                  left: sidebarOpen ? "16rem" : "2.5rem",
                  right: selectedNodeId && codePanelOpen && !codePanelExpanded ? "32rem" : "0",
                  top: "0",
                  bottom: "0",
                }
              : {
                  left: sidebarOpen ? "17.5rem" : "3.5rem",
                  bottom: "1rem",
                  width: chatOpen ? "36rem" : "auto",
                }
          }
        >
          {chatOpen ? (
            <div
              className={`bg-black/60 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/50 overflow-hidden ${
                chatExpanded ? "h-full rounded-none border-l" : "rounded-2xl"
              }`}
            >
              <ChatPanel
                chat={chat}
                contextNodeIds={contextNodeIds}
                nodes={data.nodes}
                cliBackend={config?.cli_backend ?? false}
                expanded={chatExpanded}
                onToggleExpand={() => setChatExpanded((v) => !v)}
                onRemoveContext={(id) =>
                  setContextNodeIds((prev) => prev.filter((nodeId) => nodeId !== id))
                }
                onClearContext={() => setContextNodeIds([])}
                onClose={() => {
                  setChatOpen(false);
                  setChatExpanded(false);
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="px-4 py-2 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 bg-black/50 backdrop-blur-xl border border-white/[0.1] rounded-full shadow-lg shadow-black/30 hover:bg-black/70 transition-colors"
            >
              <ChatIcon />
              <span>Chat</span>
              {contextNodeIds.length > 0 ? (
                <span className="px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/25 rounded-full text-xs text-cyan-400">
                  {contextNodeIds.length}
                </span>
              ) : !config?.cli_backend ? (
                <span className="text-xs text-slate-600">Select context first</span>
              ) : null}
            </button>
          )}
        </div>
      </div>
    </div>
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
