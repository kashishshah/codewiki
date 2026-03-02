export const KIND_COLORS: Record<string, string> = {
  function: "#4fc3f7",
  struct: "#66ffcc",
  enum: "#ffb74d",
  trait: "#b388ff",
  impl: "#f48fb1",
  module: "#4dd0e1",
  file: "#78909c",
  constant: "#ff8a65",
  type_alias: "#80cbc4",
};

export const EDGE_COLORS: Record<string, string> = {
  contains: "rgba(255,255,255,0.08)",
  calls: "#4fc3f7",
  imports: "#66ffcc",
  implements: "#b388ff",
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
