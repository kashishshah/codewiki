import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { GraphNode } from "../types";

interface ChatPanelProps {
  chat: {
    messages: { role: string; content: string }[];
    streaming: boolean;
    sendMessage: (text: string, contextNodeIds: string[]) => void;
    cancel: () => void;
    clear: () => void;
  };
  contextNodeIds: string[];
  nodes: GraphNode[];
  onRemoveContext: (id: string) => void;
  onClose: () => void;
}

export function ChatPanel({
  chat,
  contextNodeIds,
  nodes,
  onRemoveContext,
  onClose,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    chat.sendMessage(input.trim(), contextNodeIds);
    setInput("");
  };

  const contextNodes = contextNodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as GraphNode[];

  return (
    <div className="flex flex-col h-72">
      <div className="px-3 py-1.5 border-b border-white/[0.07] flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chat</span>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 text-sm px-1"
          title="Close chat"
        >
          ▼
        </button>
      </div>
      {contextNodes.length > 0 && (
        <div className="px-3 py-2 border-b border-white/[0.07] flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Context:</span>
          {contextNodes.map((n) => (
            <span
              key={n.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-900/50 border border-cyan-700 rounded text-xs text-cyan-300"
            >
              {n.name}
              <button onClick={() => onRemoveContext(n.id)} className="hover:text-cyan-100">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {chat.messages.length === 0 && (
          <p className="text-sm text-slate-500 text-center mt-8">
            Select code nodes (double-click) to add context, then ask a question.
          </p>
        )}
        {chat.messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${msg.role === "user" ? "text-blue-300" : "text-slate-300"}`}
          >
            <span className="text-xs text-slate-500 mr-2">
              {msg.role === "user" ? "You" : "Claude"}:
            </span>
            {msg.role === "assistant" ? (
              <div className="inline prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <span>{msg.content}</span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-white/[0.07] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            contextNodeIds.length > 0
              ? "Ask about the selected code..."
              : "Add context nodes first (double-click in graph)..."
          }
          className="flex-1 px-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          disabled={chat.streaming}
        />
        {chat.streaming ? (
          <button
            type="button"
            onClick={chat.cancel}
            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
        <button
          type="button"
          onClick={chat.clear}
          className="px-3 py-1.5 bg-white/[0.07] text-slate-300 rounded text-sm hover:bg-white/[0.1]"
        >
          Clear
        </button>
      </form>
    </div>
  );
}
