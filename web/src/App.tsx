import { useState } from "react";
import { useGraph, useNodeDetail } from "./hooks/useGraph";
import { useChat } from "./hooks/useChat";
import { searchNodes } from "./api";
import { KIND_COLORS } from "./constants";
import { FileTree } from "./components/FileTree";
import { GraphView } from "./components/GraphView";
import { CodePanel } from "./components/CodePanel";
import { ChatPanel } from "./components/ChatPanel";

function App() {
  const { data, loading, error } = useGraph();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextNodeIds, setContextNodeIds] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [codePanelOpen, setCodePanelOpen] = useState(true);
  const [scopedPath, setScopedFilePath] = useState<string | null>(null);
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
      <div className="flex flex-1 min-h-0">
        <div
          className={`border-r border-white/[0.07] bg-[#0a0a0a] flex flex-col transition-all ${
            sidebarOpen ? "w-64" : "w-10"
          }`}
        >
          <div className="p-2 border-b border-white/[0.07] flex items-center justify-between shrink-0">
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
              {sidebarOpen ? "◀" : "▶"}
            </button>
          </div>
          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto">
              <FileTree
                entries={data.file_tree}
                onSelectFile={(path) => {
                  setSelectedNodeId(path);
                  setScopedFilePath((prev) => (prev === path ? null : path));
                }}
              />
            </div>
          )}
        </div>

        <div className="flex-1 relative">
          <GraphView
            nodes={data.nodes}
            edges={data.edges}
            selectedNodeId={selectedNodeId}
            contextNodeIds={contextNodeIds}
            scopedPath={scopedPath}
            onSelectNode={handleSelectNode}
            onToggleContext={toggleContext}
            onClearScope={() => setScopedFilePath(null)}
          />
          <div className="absolute top-3 left-3 right-3">
            <SearchBar onSelect={handleSelectNode} />
          </div>
        </div>

        {selectedNodeId && (
          <div
            className={`border-l border-white/[0.07] bg-[#0a0a0a] flex flex-col transition-all ${
              codePanelOpen ? "w-[32rem]" : "w-10"
            }`}
          >
            <div className="p-2 border-b border-white/[0.07] flex items-center justify-between shrink-0">
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
                {codePanelOpen ? "▶" : "◀"}
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
      </div>

      <div className="border-t border-white/[0.07] bg-[#0a0a0a]">
        {chatOpen ? (
          <ChatPanel
            chat={chat}
            contextNodeIds={contextNodeIds}
            nodes={data.nodes}
            onRemoveContext={(id) =>
              setContextNodeIds((prev) => prev.filter((nodeId) => nodeId !== id))
            }
            onClose={() => setChatOpen(false)}
          />
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="w-full px-4 py-2 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
          >
            <span>Chat with codebase</span>
            {contextNodeIds.length > 0 && (
              <span className="px-1.5 py-0.5 bg-cyan-900/50 border border-cyan-700 rounded text-xs text-cyan-300">
                {contextNodeIds.length} node
                {contextNodeIds.length > 1 ? "s" : ""} selected
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SearchBar({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [open, setOpen] = useState(false);

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
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search symbols..."
        className="w-full px-3 py-1.5 bg-black/40 backdrop-blur-xl border border-white/[0.1] rounded-full text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-white/[0.07] rounded shadow-lg z-50 max-h-60 overflow-y-auto">
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
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-xs font-mono"
      style={{ backgroundColor: KIND_COLORS[kind] || "#78909c", color: "#000" }}
    >
      {kind.charAt(0).toUpperCase()}
    </span>
  );
}

export default App;
