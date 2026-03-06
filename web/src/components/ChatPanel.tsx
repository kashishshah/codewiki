import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { GraphNode } from "../types";
import { ExpandIcon, ShrinkIcon } from "./Icons";

interface ChatPanelProps {
  chat: {
    messages: { role: string; content: string }[];
    sendMessage: (text: string, contextNodeIds: string[]) => void;
    clear: () => void;
  };
  contextNodeIds: string[];
  nodes: GraphNode[];
  cliBackend: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRemoveContext: (id: string) => void;
  onClearContext: () => void;
  onClose: () => void;
}

export function ChatPanel({
  chat,
  contextNodeIds,
  nodes,
  cliBackend,
  expanded,
  onToggleExpand,
  onRemoveContext,
  onClearContext,
  onClose,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const needsContext = !cliBackend && contextNodeIds.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || needsContext) return;
    chat.sendMessage(input.trim(), contextNodeIds);
    setInput("");
  };

  const contextNodes = contextNodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as GraphNode[];

  return (
    <div className={`flex flex-col ${expanded ? "h-full" : "h-[28rem]"}`}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-200">Chat</span>
          {chat.messages.length > 0 && (
            <button
              type="button"
              onClick={chat.clear}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleExpand}
            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors"
            title={expanded ? "Shrink chat" : "Expand chat"}
          >
            {expanded ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors text-xs"
            title="Close chat"
          >
            {"\u2715"}
          </button>
        </div>
      </div>

      {/* Context chips */}
      {contextNodes.length > 0 && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-600">
              Context ({contextNodes.length})
            </span>
            <button
              onClick={onClearContext}
              className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div
            className="max-h-24 overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex flex-wrap gap-1">
              {contextNodes.map((n) => (
                <span
                  key={n.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[11px] text-cyan-400"
                >
                  {n.name}
                  <button
                    onClick={() => onRemoveContext(n.id)}
                    className="hover:text-cyan-200 text-cyan-600 ml-0.5"
                  >
                    {"\u00d7"}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.messages.length === 0 && (
          <p className="text-sm text-slate-600 text-center mt-10">
            {needsContext
              ? "Double-click nodes to add context before chatting."
              : cliBackend && contextNodeIds.length === 0
                ? "Ask anything — the CLI will explore the project to answer."
                : "Double-click nodes to add context, then ask a question."}
          </p>
        )}
        {chat.messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] text-violet-400">C</span>
              </div>
            )}
            <div
              className={`max-w-[85%] text-sm leading-relaxed ${
                msg.role === "user"
                  ? "px-3 py-2 rounded-2xl rounded-br-md bg-blue-600/20 border border-blue-500/20 text-blue-100"
                  : "text-slate-300"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_pre]:bg-white/[0.04] [&_pre]:rounded-lg [&_code]:text-cyan-300">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 shrink-0">
        <div className="flex gap-2 items-center bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-1.5 focus-within:border-blue-500/40 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              needsContext
                ? "Select context nodes first (double-click)..."
                : contextNodeIds.length > 0
                  ? "Ask about the selected code..."
                  : "Ask anything about the codebase..."
            }
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none py-1"
            disabled={needsContext}
          />
          <button
            type="submit"
            className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30 transition-colors disabled:opacity-30"
            disabled={!input.trim() || needsContext}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
