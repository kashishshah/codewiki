use anyhow::{Context, Result};
use std::path::Path;
use streaming_iterator::StreamingIterator;
use tree_sitter::{Parser, Query, QueryCursor};

use crate::graph::{CodeNode, NodeKind, Span};

use super::{LanguageParser, ParseResult};

pub struct PythonParser {
    query_source: &'static str,
}

impl PythonParser {
    pub fn new() -> Self {
        Self {
            query_source: include_str!("queries/python.scm"),
        }
    }

    fn make_node_id(file_path: &str, kind: &str, name: &str) -> String {
        format!("{file_path}::{kind}::{name}")
    }
}

impl LanguageParser for PythonParser {
    fn name(&self) -> &str {
        "python"
    }

    fn extensions(&self) -> &[&str] {
        &["py"]
    }

    fn parse_file(&self, path: &Path, content: &str) -> Result<ParseResult> {
        let lang: tree_sitter::Language = tree_sitter_python::LANGUAGE.into();

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
                // function_definition
                0 => {
                    let (name, _) = extract_capture(m, capture_names, "fn_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "function", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "fn", &name),
                            name,
                            kind: NodeKind::Function,
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
                // class_definition
                1 => {
                    let (name, _) = extract_capture(m, capture_names, "class_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "class_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "class", &name),
                            name,
                            kind: NodeKind::Class,
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
                // import_statement
                2 => {
                    let (import_path, _) =
                        extract_capture(m, capture_names, "import_path", content);
                    if let Some(path) = import_path {
                        imports.push(path);
                    }
                }
                // import_from_statement
                3 => {
                    let (import_path, _) =
                        extract_capture(m, capture_names, "import_path", content);
                    if let Some(path) = import_path {
                        imports.push(path);
                    }
                }
                // call expression
                4 => {
                    let (call_name, _) = extract_capture(m, capture_names, "call_name", content);
                    if let Some(call_name) = call_name {
                        let call_node = m
                            .captures
                            .iter()
                            .find(|c| capture_names[c.index as usize] == "call_expr");
                        if let Some(call_cap) = call_node {
                            let caller =
                                find_enclosing_function(call_cap.node, content, &file_path_str);
                            if let Some(caller_id) = caller {
                                calls.push((caller_id, call_name));
                            }
                        }
                    }
                }
                // method call
                5 => {
                    let (method_name, _) =
                        extract_capture(m, capture_names, "method_name", content);
                    if let Some(method_name) = method_name {
                        let call_node = m
                            .captures
                            .iter()
                            .find(|c| capture_names[c.index as usize] == "method_call");
                        if let Some(call_cap) = call_node {
                            let caller =
                                find_enclosing_function(call_cap.node, content, &file_path_str);
                            if let Some(caller_id) = caller {
                                calls.push((caller_id, method_name));
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
        if parent.kind() == "function_definition"
            && let Some(name_node) = parent.child_by_field_name("name")
        {
            let name = name_node.utf8_text(content.as_bytes()).ok()?;
            return Some(format!("{file_path}::fn::{name}"));
        }
        current = parent.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_python_function() {
        let parser = PythonParser::new();
        let content = r#"
def hello(name: str) -> str:
    return f"Hello, {name}!"
"#;
        let result = parser.parse_file(Path::new("test.py"), content).unwrap();
        assert_eq!(result.nodes.len(), 1);
        assert_eq!(result.nodes[0].name, "hello");
        assert_eq!(result.nodes[0].kind, NodeKind::Function);
    }

    #[test]
    fn test_parse_python_class() {
        let parser = PythonParser::new();
        let content = r#"
class MyClass:
    def __init__(self):
        self.value = 0

    def get_value(self):
        return self.value
"#;
        let result = parser.parse_file(Path::new("test.py"), content).unwrap();
        let kinds: Vec<_> = result.nodes.iter().map(|n| n.kind).collect();
        assert!(kinds.contains(&NodeKind::Class));
        assert!(kinds.contains(&NodeKind::Function));
    }

    #[test]
    fn test_parse_python_imports() {
        let parser = PythonParser::new();
        let content = r#"
import os
from pathlib import Path
"#;
        let result = parser.parse_file(Path::new("test.py"), content).unwrap();
        assert_eq!(result.imports.len(), 2);
    }
}
