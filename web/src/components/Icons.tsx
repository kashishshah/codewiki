export function ChevronLeft() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9,2 4,7 9,12" />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5,2 10,7 5,12" />
    </svg>
  );
}

export function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polyline points="1,5 1,1 5,1" />
      <polyline points="13,9 13,13 9,13" />
      <line x1="1" y1="1" x2="6" y2="6" />
      <line x1="13" y1="13" x2="8" y2="8" />
    </svg>
  );
}

export function ShrinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polyline points="9,1 13,1 13,5" />
      <polyline points="5,13 1,13 1,9" />
      <line x1="13" y1="1" x2="8" y2="6" />
      <line x1="1" y1="13" x2="6" y2="8" />
    </svg>
  );
}

export function ChatIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-60"
    >
      <path d="M1 2.5a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 2.5V10.5H2a1 1 0 01-1-1v-7z" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      className="text-slate-500 pointer-events-none"
    >
      <circle cx="6" cy="6" r="4.5" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" />
    </svg>
  );
}

export function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      className="opacity-60"
    >
      <line x1="1" y1="3" x2="13" y2="3" />
      <line x1="3" y1="7" x2="11" y2="7" />
      <line x1="5" y1="11" x2="9" y2="11" />
    </svg>
  );
}
