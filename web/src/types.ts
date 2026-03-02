export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  file_path: string;
  start_line: number;
  end_line: number;
  visibility: string | null;
  children: string[];
  parent: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileEntry[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  file_tree: FileEntry[];
}

export interface NodeDetail extends GraphNode {
  body: string;
}
