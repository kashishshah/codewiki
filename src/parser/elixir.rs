use anyhow::{Context, Result};
use std::path::Path;
use tree_sitter::{Parser, Query, QueryCursor, StreamingIterator};

use crate::graph::{CodeNode, NodeKind, Span};

use super::{LanguageParser, ParseResult};

pub struct ElixirParser {
    query_source: &'static str,
}

impl ElixirParser {
    pub fn new() -> Self {
        Self {
            query_source: include_str!("queries/elixir.scm"),
        }
    }

    fn make_node_id(file_path: &str, kind: &str, name: &str) -> String {
        format!("{file_path}::{kind}::{name}")
    }
}

impl LanguageParser for ElixirParser {
    fn name(&self) -> &str {
        "elixir"
    }

    fn extensions(&self) -> &[&str] {
        &["ex", "exs"]
    }

    fn parse_file(&self, path: &Path, content: &str) -> Result<ParseResult> {
        let lang: tree_sitter::Language = tree_sitter_elixir::LANGUAGE.into();

        let mut parser = Parser::new();
        parser
            .set_language(&lang)
            .context("failed to set tree-sitter language")?;

        let tree = parser
            .parse(content, None)
            .context("tree-sitter parse failed")?;

        let query =
            Query::new(&lang, self.query_source).context("failed to compile tree-sitter query")?;

        let capture_names = query.capture_names();
        let file_path_str = path.to_string_lossy().to_string();

        let mut nodes = Vec::new();
        let mut calls = Vec::new();
        let mut imports = Vec::new();

        let mut cursor = QueryCursor::new();
        let mut matches = cursor.matches(&query, tree.root_node(), content.as_bytes());

        while let Some(m) = matches.next() {
            match m.pattern_index {
                0 => {
                    let (name, _) = extract_capture(m, capture_names, "module_name", content);
                    let (body, body_span) =
                        extract_capture(m, capture_names, "module_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "mod", &name),
                            name,
                            kind: NodeKind::Module,
                            file_path: file_path_str.clone(),
                            language: String::new(),
                            span,
                            body,
                            visibility: Some("pub".to_string()),
                            children: Vec::new(),
                            parent: None,
                        });
                    }
                }
                1 => {
                    let (keyword, _) = extract_capture(m, capture_names, "keyword", content);
                    let (name, _) = extract_capture(m, capture_names, "fn_name", content);
                    let (body, body_span) =
                        extract_capture(m, capture_names, "function_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = match keyword.as_deref() {
                            Some("defp") => None,
                            _ => Some("pub".to_string()),
                        };
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "fn", &name),
                            name,
                            kind: NodeKind::Function,
                            file_path: file_path_str.clone(),
                            language: String::new(),
                            span,
                            body,
                            visibility: vis,
                            children: Vec::new(),
                            parent: None,
                        });
                    }
                }
                2 => {
                    let (keyword, _) = extract_capture(m, capture_names, "keyword", content);
                    let (name, _) = extract_capture(m, capture_names, "fn_name_simple", content);
                    let (body, body_span) =
                        extract_capture(m, capture_names, "function_def_simple", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = match keyword.as_deref() {
                            Some("defp") => None,
                            _ => Some("pub".to_string()),
                        };
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "fn", &name),
                            name,
                            kind: NodeKind::Function,
                            file_path: file_path_str.clone(),
                            language: String::new(),
                            span,
                            body,
                            visibility: vis,
                            children: Vec::new(),
                            parent: None,
                        });
                    }
                }
                3 => {
                    let (name, _) = extract_capture(m, capture_names, "protocol_name", content);
                    let (body, body_span) =
                        extract_capture(m, capture_names, "protocol_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "trait", &name),
                            name,
                            kind: NodeKind::Trait,
                            file_path: file_path_str.clone(),
                            language: String::new(),
                            span,
                            body,
                            visibility: Some("pub".to_string()),
                            children: Vec::new(),
                            parent: None,
                        });
                    }
                }
                4 => {
                    let (name, _) = extract_capture(m, capture_names, "impl_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "impl_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "impl", &name),
                            name: format!("impl {name}"),
                            kind: NodeKind::Impl,
                            file_path: file_path_str.clone(),
                            language: String::new(),
                            span,
                            body,
                            visibility: None,
                            children: Vec::new(),
                            parent: None,
                        });
                    }
                }
                5 => {
                    let (import_path, _) =
                        extract_capture(m, capture_names, "import_path", content);
                    if let Some(path) = import_path {
                        imports.push(path);
                    }
                }
                6 => {
                    let (call_name, _) = extract_capture(m, capture_names, "call_name", content);
                    if let Some(ref name) = call_name {
                        if matches!(
                            name.as_str(),
                            "defmodule"
                                | "def"
                                | "defp"
                                | "defmacro"
                                | "defprotocol"
                                | "defimpl"
                                | "defstruct"
                                | "use"
                                | "import"
                                | "alias"
                                | "require"
                                | "if"
                                | "unless"
                                | "case"
                                | "cond"
                                | "with"
                                | "for"
                                | "raise"
                                | "test"
                                | "describe"
                                | "setup"
                        ) {
                            continue;
                        }
                        let call_node = m
                            .captures
                            .iter()
                            .find(|c| capture_names[c.index as usize] == "call_expr");
                        if let Some(call_cap) = call_node {
                            let caller =
                                find_enclosing_function(call_cap.node, content, &file_path_str);
                            if let Some(caller_id) = caller {
                                calls.push((caller_id, name.clone()));
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(ParseResult {
            nodes,
            calls,
            imports,
        })
    }
}

fn extract_capture(
    m: &tree_sitter::QueryMatch<'_, '_>,
    capture_names: &[&str],
    target_name: &str,
    source: &str,
) -> (Option<String>, Option<Span>) {
    for cap in m.captures.iter() {
        if capture_names[cap.index as usize] == target_name {
            let node = cap.node;
            let text = source[node.byte_range()].to_string();
            let span = Span {
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
                start_col: node.start_position().column,
                end_col: node.end_position().column,
            };
            return (Some(text), Some(span));
        }
    }
    (None, None)
}

fn find_enclosing_function(
    node: tree_sitter::Node,
    content: &str,
    file_path: &str,
) -> Option<String> {
    let mut current = node.parent();
    while let Some(parent) = current {
        // In Elixir, functions are `call` nodes with target "def"/"defp".
        // We look for the enclosing call whose target is def/defp and extract
        // the function name from its arguments.
        if parent.kind() == "call"
            && let Some(target) = parent.child_by_field_name("target")
            && target.kind() == "identifier"
        {
            let target_name = target.utf8_text(content.as_bytes()).ok()?;
            if target_name == "def" || target_name == "defp" {
                // The function name is in the arguments — first arg is a call node
                // whose target is the function identifier
                if let Some(args) = parent
                    .children(&mut parent.walk())
                    .find(|c| c.kind() == "arguments")
                    && let Some(first_arg) = args.named_child(0)
                {
                    let fn_name = if first_arg.kind() == "call" {
                        first_arg
                            .child_by_field_name("target")
                            .and_then(|t| t.utf8_text(content.as_bytes()).ok())
                    } else if first_arg.kind() == "identifier" {
                        first_arg.utf8_text(content.as_bytes()).ok()
                    } else {
                        None
                    };
                    if let Some(name) = fn_name {
                        return Some(format!("{file_path}::fn::{name}"));
                    }
                }
            }
        }
        current = parent.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_elixir_module() {
        let parser = ElixirParser::new();
        let content = r#"
defmodule MyApp.Worker do
  def start(args) do
    :ok
  end

  defp internal_work do
    :done
  end
end
"#;
        let result = parser.parse_file(Path::new("test.ex"), content).unwrap();
        let kinds: Vec<_> = result.nodes.iter().map(|n| n.kind).collect();
        assert!(kinds.contains(&NodeKind::Module));
        assert!(kinds.contains(&NodeKind::Function));
    }

    #[test]
    fn test_parse_elixir_imports() {
        let parser = ElixirParser::new();
        let content = r#"
defmodule MyApp do
  use GenServer
  import Enum
  alias MyApp.Repo
end
"#;
        let result = parser.parse_file(Path::new("test.ex"), content).unwrap();
        assert!(!result.imports.is_empty());
    }
}
