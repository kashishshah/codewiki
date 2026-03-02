import { useState } from "react";
import type { FileEntry } from "../types";

interface FileTreeProps {
  entries: FileEntry[];
  onSelectFile: (path: string) => void;
  depth?: number;
}

export function FileTree({ entries, onSelectFile, depth = 0 }: FileTreeProps) {
  return (
    <div className={depth > 0 ? "ml-3" : ""}>
      {entries.map((entry) => (
        <FileTreeNode key={entry.path} entry={entry} onSelectFile={onSelectFile} depth={depth} />
      ))}
    </div>
  );
}

function FileTreeNode({
  entry,
  onSelectFile,
  depth,
}: {
  entry: FileEntry;
  onSelectFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (entry.is_dir) {
    return (
      <div>
        <div className="flex items-center hover:bg-white/[0.05] text-sm text-slate-400">
          <button onClick={() => setExpanded(!expanded)} className="px-1 py-1 text-xs shrink-0">
            {expanded ? "▼" : "▶"}
          </button>
          <button
            onClick={() => {
              setExpanded(true);
              onSelectFile(entry.path);
            }}
            className="flex-1 text-left py-1 flex items-center gap-1"
          >
            <span className="text-yellow-500">📁</span>
            <span>{entry.name}</span>
          </button>
        </div>
        {expanded && (
          <FileTree entries={entry.children} onSelectFile={onSelectFile} depth={depth + 1} />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(entry.path)}
      className="w-full text-left px-2 py-1 hover:bg-white/[0.05] text-sm flex items-center gap-1 text-slate-300 ml-3"
    >
      <span className="text-slate-500">📄</span>
      <span>{entry.name}</span>
    </button>
  );
}
