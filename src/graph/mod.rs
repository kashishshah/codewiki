pub mod store;

use anyhow::{Context, Result};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::Path,
};

use crate::parser::ParserRegistry;

pub type NodeId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGraph {
    pub nodes: HashMap<NodeId, CodeNode>,
    pub edges: Vec<CodeEdge>,
    pub file_tree: Vec<FileEntry>,
}

impl CodeGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: Vec::new(),
            file_tree: Vec::new(),
        }
    }

    pub fn add_node(&mut self, node: CodeNode) {
        self.nodes.insert(node.id.clone(), node);
    }

    pub fn add_edge(&mut self, edge: CodeEdge) {
        self.edges.push(edge);
    }

    pub fn search(&self, query: &str) -> Vec<&CodeNode> {
        let q = query.to_lowercase();
        self.nodes
            .values()
            .filter(|n| n.name.to_lowercase().contains(&q))
            .collect()
    }

    /// Walk a directory, parse all supported files, and build the graph.
    pub fn from_directory(root: &Path, registry: &ParserRegistry) -> Result<Self> {
        let mut graph = Self::new();
        let root = root
            .canonicalize()
            .context("failed to canonicalize project root")?;

        let walker = WalkBuilder::new(&root)
            .hidden(true)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .build();

        for entry in walker {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    tracing::warn!("failed to read directory entry: {e}");
                    continue;
                }
            };

            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let parser = match registry.get_parser(path) {
                Some(p) => p,
                None => continue,
            };

            let content = match fs::read_to_string(path) {
                Ok(c) => c,
                Err(e) => {
                    tracing::debug!("skipping {}: {e}", path.display());
                    continue;
                }
            };

            let rel_path = path
                .strip_prefix(&root)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();

            let lang = parser.name().to_string();
            let file_id = rel_path.clone();
            let file_node = CodeNode {
                id: file_id.clone(),
                name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                kind: NodeKind::File,
                file_path: rel_path.clone(),
                language: lang.clone(),
                span: Span {
                    start_line: 1,
                    end_line: content.lines().count(),
                    start_col: 0,
                    end_col: 0,
                },
                body: String::new(),
                visibility: None,
                children: Vec::new(),
                parent: None,
            };
            graph.add_node(file_node);

            let result = match parser.parse_file(Path::new(&rel_path), &content) {
                Ok(r) => r,
                Err(e) => {
                    tracing::warn!("failed to parse {}: {e}", rel_path);
                    continue;
                }
            };

            let mut child_ids = Vec::new();
            for mut node in result.nodes {
                node.file_path = rel_path.clone();
                node.language = lang.clone();
                let kind_str = match node.kind {
                    NodeKind::Function => "fn",
                    NodeKind::Struct => "struct",
                    NodeKind::Enum => "enum",
                    NodeKind::Trait => "trait",
                    NodeKind::Impl => "impl",
                    NodeKind::Module => "mod",
                    NodeKind::Constant => "const",
                    NodeKind::TypeAlias => "type",
                    NodeKind::Class => "class",
                    _ => "item",
                };
                node.id = format!("{}::{}::{}", rel_path, kind_str, node.name);
                node.parent = Some(file_id.clone());
                child_ids.push(node.id.clone());

                graph.add_edge(CodeEdge {
                    from: file_id.clone(),
                    to: node.id.clone(),
                    kind: EdgeKind::Contains,
                });

                graph.add_node(node);
            }

            if let Some(file_node) = graph.nodes.get_mut(&file_id) {
                file_node.children = child_ids;
            }

            for (caller_id, callee_name) in &result.calls {
                let caller_id = caller_id.replace(&path.to_string_lossy().to_string(), &rel_path);
                let callee_id = graph
                    .nodes
                    .values()
                    .find(|n| n.name == *callee_name && n.kind == NodeKind::Function)
                    .map(|n| n.id.clone());
                if let Some(callee_id) = callee_id
                    && caller_id != callee_id
                {
                    graph.add_edge(CodeEdge {
                        from: caller_id,
                        to: callee_id,
                        kind: EdgeKind::Calls,
                    });
                }
            }
        }

        graph.file_tree = build_file_tree(&graph)?;

        Ok(graph)
    }
}

fn build_file_tree(graph: &CodeGraph) -> Result<Vec<FileEntry>> {
    let mut dirs: BTreeMap<String, Vec<FileEntry>> = BTreeMap::new();

    for node in graph.nodes.values() {
        if node.kind != NodeKind::File {
            continue;
        }
        let path = Path::new(&node.file_path);
        let parent = path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        dirs.entry(parent.clone()).or_default().push(FileEntry {
            name: node.name.clone(),
            path: node.file_path.clone(),
            is_dir: false,
            children: Vec::new(),
        });

        // Ensure all ancestor directories exist as keys so build_level can
        // discover them even when they contain no direct files.
        let mut ancestor = parent;
        while !ancestor.is_empty() {
            let next = Path::new(&ancestor)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            dirs.entry(ancestor).or_default();
            ancestor = next;
        }
    }

    fn build_level(prefix: &str, dirs: &BTreeMap<String, Vec<FileEntry>>) -> Vec<FileEntry> {
        let mut entries = Vec::new();

        if let Some(files) = dirs.get(prefix) {
            for f in files {
                entries.push(f.clone());
            }
        }

        for key in dirs.keys() {
            if key == prefix {
                continue;
            }
            let parent = Path::new(key)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if parent == prefix {
                let dir_name = Path::new(key)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                entries.push(FileEntry {
                    name: dir_name,
                    path: key.clone(),
                    is_dir: true,
                    children: build_level(key, dirs),
                });
            }
        }

        entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
        entries
    }

    Ok(build_level("", &dirs))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeNode {
    pub id: NodeId,
    pub name: String,
    pub kind: NodeKind,
    pub file_path: String,
    pub language: String,
    pub span: Span,
    pub body: String,
    pub visibility: Option<String>,
    pub children: Vec<NodeId>,
    pub parent: Option<NodeId>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    File,
    Module,
    Function,
    Struct,
    Enum,
    Trait,
    Impl,
    Constant,
    TypeAlias,
    Class,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Span {
    pub start_line: usize,
    pub end_line: usize,
    pub start_col: usize,
    pub end_col: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEdge {
    pub from: NodeId,
    pub to: NodeId,
    pub kind: EdgeKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeKind {
    Contains,
    Calls,
    Imports,
    Implements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileEntry>,
}
