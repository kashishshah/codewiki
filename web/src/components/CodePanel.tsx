import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import rust from "highlight.js/lib/languages/rust";
import "highlight.js/styles/atom-one-dark.css";
import type { NodeDetail } from "../types";
import { KindBadge } from "../App";

hljs.registerLanguage("rust", rust);

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
      <div className="p-3 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <KindBadge kind={detail.kind} />
          <span className="text-sm font-medium text-slate-200 truncate">{detail.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleContext}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              isContext
                ? "bg-cyan-600 text-white"
                : "bg-white/[0.07] text-slate-300 hover:bg-white/[0.1]"
            }`}
            title={isContext ? "Remove from chat context" : "Add to chat context"}
          >
            {isContext ? "− Chat" : "+ Chat"}
          </button>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded text-xs bg-white/[0.07] text-slate-300 hover:bg-white/[0.1]"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-white/[0.07] text-xs text-slate-500">
        <span>{detail.file_path}</span>
        <span className="mx-2">·</span>
        <span>
          L{detail.start_line}–{detail.end_line}
        </span>
        {detail.visibility && (
          <>
            <span className="mx-2">·</span>
            <span className="text-emerald-400">{detail.visibility}</span>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {detail.body ? (
          <pre className="text-xs leading-relaxed">
            <code ref={codeRef} className="language-rust">
              {detail.body}
            </code>
          </pre>
        ) : (
          <p className="text-slate-500 text-sm">
            {detail.kind === "file"
              ? "File node — select a child symbol to view its source."
              : "No source body available."}
          </p>
        )}
      </div>

      {detail.children.length > 0 && (
        <div className="border-t border-white/[0.07] p-3">
          <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase">Contains</h3>
          <div className="flex flex-wrap gap-1">
            {detail.children.map((childId) => {
              const name = childId.split("::").pop() || childId;
              return (
                <span
                  key={childId}
                  className="px-2 py-0.5 bg-white/[0.05] rounded text-xs text-slate-300"
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
