import { useState, useRef, useEffect } from "react";
import { searchNodes } from "../api";
import { KIND_COLORS, FILTERABLE_KINDS } from "../constants";
import { KindBadge } from "./KindBadge";
import { SearchIcon, FilterIcon } from "./Icons";

interface SearchBarProps {
  onSelect: (id: string) => void;
  hiddenKinds: Set<string>;
  onToggleKind: (kind: string) => void;
  hiddenLanguages: Set<string>;
  onToggleLanguage: (lang: string) => void;
  detectedLanguages: string[];
  minLines: number;
  onMinLinesChange: (v: number) => void;
  hideTests: boolean;
  onToggleHideTests: () => void;
}

export function SearchBar({
  onSelect,
  hiddenKinds,
  onToggleKind,
  hiddenLanguages,
  onToggleLanguage,
  detectedLanguages,
  minLines,
  onMinLinesChange,
  hideTests,
  onToggleHideTests,
}: SearchBarProps) {
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
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search..."
          className="w-full pl-9 pr-3 py-1.5 bg-black/40 backdrop-blur-xl border border-white/[0.1] rounded-full text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-black/80 backdrop-blur-xl border border-white/[0.07] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onSelect(r.id);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/[0.05] text-sm flex items-center gap-2 transition-colors"
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
            hiddenKinds.size > 0 || hiddenLanguages.size > 0 || minLines > 0
              ? "border-blue-500/50"
              : "border-white/[0.1]"
          }`}
          title="Filter node kinds"
        >
          <span className="flex items-center gap-1.5">
            <FilterIcon />
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
            {detectedLanguages.length > 1 && (
              <div className="border-t border-white/[0.06] mt-1.5 pt-2 px-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                  Languages
                </span>
                {detectedLanguages.map((lang) => {
                  const hidden = hiddenLanguages.has(lang);
                  return (
                    <label
                      key={lang}
                      className="flex items-center gap-2 px-0 py-1 hover:bg-white/[0.05] rounded cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={() => onToggleLanguage(lang)}
                        className="accent-blue-500"
                      />
                      <span
                        className={`text-slate-300 capitalize ${hidden ? "line-through opacity-50" : ""}`}
                      >
                        {lang}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
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
