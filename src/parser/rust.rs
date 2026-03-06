use anyhow::{Context, Result};
use std::path::Path;
use tree_sitter::{Parser, Query, QueryCursor, StreamingIterator};

use crate::graph::{CodeNode, NodeKind, Span};

use super::{LanguageParser, ParseResult};

#[derive(Clone)]
pub struct RustParser {
    query_source: &'static str,
}

impl RustParser {
    pub fn new() -> Self {
        Self {
            query_source: include_str!("queries/rust.scm"),
        }
    }

    fn make_node_id(file_path: &str, kind: &str, name: &str) -> String {
        format!("{file_path}::{kind}::{name}")
    }
}

impl LanguageParser for RustParser {
    fn name(&self) -> &str {
        "rust"
    }

    fn extensions(&self) -> &[&str] {
        &["rs"]
    }

    fn parse_file(&self, path: &Path, content: &str) -> Result<ParseResult> {
        let lang: tree_sitter::Language = tree_sitter_rust::LANGUAGE.into();

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
            let pattern_idx = m.pattern_index;

            match pattern_idx {
                0 => {
                    let (name, _) = extract_capture(m, capture_names, "fn_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "function", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = extract_visibility(&body);
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
                1 => {
                    let (name, _) = extract_capture(m, capture_names, "struct_name", content);
                    let (body, body_span) =
                        extract_capture(m, capture_names, "struct_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = extract_visibility(&body);
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "struct", &name),
                            name,
                            kind: NodeKind::Struct,
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
                    let (name, _) = extract_capture(m, capture_names, "enum_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "enum_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = extract_visibility(&body);
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "enum", &name),
                            name,
                            kind: NodeKind::Enum,
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
                    let (name, _) = extract_capture(m, capture_names, "trait_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "trait_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = extract_visibility(&body);
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "trait", &name),
                            name,
                            kind: NodeKind::Trait,
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
                4 => {
                    let (impl_type, _) = extract_capture(m, capture_names, "impl_type", content);
                    let (body, body_span) = extract_capture(m, capture_names, "impl_def", content);
                    if let (Some(impl_type), Some(body), Some(span)) = (impl_type, body, body_span)
                    {
                        let name = format!("impl {impl_type}");
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "impl", &impl_type),
                            name,
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
                    let (use_path, _) = extract_capture(m, capture_names, "use_path", content);
                    if let Some(use_path) = use_path {
                        imports.push(use_path);
                    }
                }
                6 => {
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
                7 => {
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
                8 => {
                    let (name, _) = extract_capture(m, capture_names, "mod_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "mod_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = extract_visibility(&body);
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "mod", &name),
                            name,
                            kind: NodeKind::Module,
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
                9 => {
                    let (name, _) = extract_capture(m, capture_names, "const_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "const_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = extract_visibility(&body);
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "const", &name),
                            name,
                            kind: NodeKind::Constant,
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
                10 => {
                    let (name, _) = extract_capture(m, capture_names, "type_name", content);
                    let (body, body_span) = extract_capture(m, capture_names, "type_def", content);
                    if let (Some(name), Some(body), Some(span)) = (name, body, body_span) {
                        let vis = extract_visibility(&body);
                        nodes.push(CodeNode {
                            id: Self::make_node_id(&file_path_str, "type", &name),
                            name,
                            kind: NodeKind::TypeAlias,
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

fn extract_visibility(body_text: &str) -> Option<String> {
    let trimmed = body_text.trim_start();
    if trimmed.starts_with("pub(crate)") {
        Some("pub(crate)".to_string())
    } else if trimmed.starts_with("pub(super)") {
        Some("pub(super)".to_string())
    } else if trimmed.starts_with("pub") {
        Some("pub".to_string())
    } else {
        None
    }
}

fn find_enclosing_function(
    node: tree_sitter::Node,
    content: &str,
    file_path: &str,
) -> Option<String> {
    let mut current = node.parent();
    while let Some(parent) = current {
        if parent.kind() == "function_item"
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
    fn test_parse_simple_function() {
        let parser = RustParser::new();
        let content = r#"
pub fn hello(name: &str) -> String {
    format!("Hello, {name}!")
}
"#;
        let result = parser.parse_file(Path::new("test.rs"), content).unwrap();
        assert_eq!(result.nodes.len(), 1);
        assert_eq!(result.nodes[0].name, "hello");
        assert_eq!(result.nodes[0].kind, NodeKind::Function);
        assert_eq!(result.nodes[0].visibility, Some("pub".to_string()));
    }

    #[test]
    fn test_parse_struct_and_impl() {
        let parser = RustParser::new();
        let content = r#"
pub struct Foo {
    pub bar: i32,
}

impl Foo {
    pub fn new() -> Self {
        Self { bar: 0 }
    }
}
"#;
        let result = parser.parse_file(Path::new("test.rs"), content).unwrap();

        let kinds: Vec<_> = result.nodes.iter().map(|n| n.kind).collect();
        assert!(kinds.contains(&NodeKind::Struct));
        assert!(kinds.contains(&NodeKind::Impl));
        assert!(kinds.contains(&NodeKind::Function));
    }

    #[test]
    fn test_parse_enum_and_trait() {
        let parser = RustParser::new();
        let content = r#"
pub enum Color {
    Red,
    Green,
    Blue,
}

pub trait Paintable {
    fn paint(&self, color: Color) {
    }
}
"#;
        let result = parser.parse_file(Path::new("test.rs"), content).unwrap();

        let kinds: Vec<_> = result.nodes.iter().map(|n| n.kind).collect();
        assert!(kinds.contains(&NodeKind::Enum));
        assert!(kinds.contains(&NodeKind::Trait));
        assert!(kinds.contains(&NodeKind::Function));
    }

    #[test]
    fn test_extracts_calls() {
        let parser = RustParser::new();
        let content = r#"
fn caller() {
    callee();
    obj.method();
}

fn callee() {}
"#;
        let result = parser.parse_file(Path::new("test.rs"), content).unwrap();

        assert!(!result.calls.is_empty());
        let call_names: Vec<_> = result
            .calls
            .iter()
            .map(|(_, callee)| callee.as_str())
            .collect();
        assert!(call_names.contains(&"callee"));
        assert!(call_names.contains(&"method"));
    }

    #[test]
    fn test_extracts_imports() {
        let parser = RustParser::new();
        let content = r#"
use std::collections::HashMap;
use crate::graph::CodeNode;
"#;
        let result = parser.parse_file(Path::new("test.rs"), content).unwrap();

        assert_eq!(result.imports.len(), 2);
    }
}
