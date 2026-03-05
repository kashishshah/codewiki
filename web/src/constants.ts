export const KIND_COLORS: Record<string, string> = {
  function: "#6b8db5",
  struct: "#7ba386",
  enum: "#c49a5c",
  trait: "#9882b5",
  impl: "#b57882",
  module: "#5a9e9e",
  file: "#5a6370",
  constant: "#c47d5a",
  type_alias: "#6b9e91",
};

export const EDGE_COLORS: Record<string, string> = {
  contains: "rgba(255,255,255,0.05)",
  calls: "rgba(107,141,181,0.5)",
  imports: "rgba(123,163,134,0.5)",
  implements: "rgba(152,130,181,0.5)",
};

export const FILTERABLE_KINDS = [
  "function",
  "struct",
  "enum",
  "trait",
  "impl",
  "module",
  "constant",
  "type_alias",
];
