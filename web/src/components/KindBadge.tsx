import { KIND_COLORS } from "../constants";

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{ backgroundColor: KIND_COLORS[kind] || "#78909c", color: "#fff" }}
    >
      {kind.charAt(0).toUpperCase()}
    </span>
  );
}
