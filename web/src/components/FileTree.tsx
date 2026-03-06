import { useState } from "react";
import type { FileEntry } from "../types";

interface FileTreeProps {
  entries: FileEntry[];
  onSelectFile: (path: string, isDir: boolean) => void;
  depth?: number;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
    >
      <polyline points="4,2 8,6 4,10" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M1.5 3.5a1 1 0 011-1h3.586a1 1 0 01.707.293L8.207 4.207a1 1 0 00.707.293H13.5a1 1 0 011 1V6H2.5a1 1 0 00-.981.804L1 9.5"
        stroke="#c49a5c"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 6h12l-1.2 6.4a1 1 0 01-.983.8H3.683a1 1 0 01-.983-.8L1.5 6z"
        stroke="#c49a5c"
        strokeWidth="1.2"
        fill="#c49a5c"
        fillOpacity="0.1"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M1.5 3.5a1 1 0 011-1h3.586a1 1 0 01.707.293L8.207 4.207a1 1 0 00.707.293H13.5a1 1 0 011 1v7a1 1 0 01-1 1h-12a1 1 0 01-1-1v-9z"
        stroke="#c49a5c"
        strokeWidth="1.2"
        fill="#c49a5c"
        fillOpacity="0.08"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path
        d="M4.5 1.5h5l4 4v9a1 1 0 01-1 1h-8a1 1 0 01-1-1v-12a1 1 0 011-1z"
        stroke="#64748b"
        strokeWidth="1.2"
        fill="#64748b"
        fillOpacity="0.06"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 1.5v4h4"
        stroke="#64748b"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  onSelectFile: (path: string, isDir: boolean) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (entry.is_dir) {
    return (
      <div>
        <div className="flex items-center hover:bg-white/[0.05] rounded-sm text-sm text-slate-400 group">
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-1 py-1 shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors"
          >
            <ChevronIcon open={expanded} />
          </button>
          <button
            onClick={() => {
              setExpanded(true);
              onSelectFile(entry.path, true);
            }}
            className="flex-1 text-left py-1 flex items-center gap-1.5"
          >
            <FolderIcon open={expanded} />
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
      onClick={() => onSelectFile(entry.path, false)}
      className="w-full text-left px-2 py-1 hover:bg-white/[0.05] rounded-sm text-sm flex items-center gap-1.5 text-slate-300 ml-3"
    >
      <FileIcon />
      <span>{entry.name}</span>
    </button>
  );
}
