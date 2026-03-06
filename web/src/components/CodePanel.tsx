import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import rust from "highlight.js/lib/languages/rust";
import python from "highlight.js/lib/languages/python";
import elixir from "highlight.js/lib/languages/elixir";
import "highlight.js/styles/atom-one-dark.css";
import type { NodeDetail } from "../types";
import { KindBadge } from "./KindBadge";

hljs.registerLanguage("rust", rust);
hljs.registerLanguage("python", python);
hljs.registerLanguage("elixir", elixir);

interface CodePanelProps {
  detail: NodeDetail | null;
  isContext: boolean;
  onToggleContext: () => void;
  onClose: () => void;
}

export function CodePanel({ detail, isContext, onToggleContext, onClose }: CodePanelProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current && detail?.body) {
      codeRef.current.textContent = detail.body;
      hljs.highlightElement(codeRef.current);
    }
  }, [detail?.body]);

  if (!detail) {
    return <div className="p-4 text-slate-500 text-sm">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <KindBadge kind={detail.kind} />
          <span className="text-sm font-medium text-slate-200 truncate">{detail.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleContext}
            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
              isContext
                ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-400"
                : "bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]"
            }`}
            title={isContext ? "Remove from chat context" : "Add to chat context"}
          >
            {isContext ? "\u2212 Context" : "+ Context"}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors text-xs"
          >
            {"\u2715"}
          </button>
        </div>
      </div>

      <div className="px-4 pb-2 text-xs text-slate-500 flex items-center gap-2">
        <span className="truncate">{detail.file_path}</span>
        <span className="text-slate-700">{"\u00b7"}</span>
        <span className="shrink-0">
          L{detail.start_line}
          {"\u2013"}
          {detail.end_line}
        </span>
        {detail.visibility && (
          <>
            <span className="text-slate-700">{"\u00b7"}</span>
            <span className="text-emerald-500/70 shrink-0">{detail.visibility}</span>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {detail.body ? (
          <pre className="text-xs leading-relaxed overflow-x-auto">
            <code ref={codeRef} className={`language-${detail.language || "rust"} whitespace-pre`}>
              {detail.body}
            </code>
          </pre>
        ) : (
          <p className="text-slate-600 text-sm">
            {detail.kind === "file"
              ? "File node \u2014 select a child symbol to view its source."
              : "No source body available."}
          </p>
        )}
      </div>

      {detail.children.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <h3 className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">
            Contains
          </h3>
          <div className="flex flex-wrap gap-1">
            {detail.children.map((childId) => {
              const name = childId.split("::").pop() || childId;
              return (
                <span
                  key={childId}
                  className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-md text-xs text-slate-400"
                >
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
