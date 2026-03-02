pub mod rust;

use anyhow::Result;
use std::{path::Path, sync::Arc};

use crate::graph::CodeNode;

/// Trait for language-specific parsers. Implement this to add support for a new language.
#[allow(dead_code)]
pub trait LanguageParser: Send + Sync {
    /// Display name for this language (e.g. "Rust"). Used for logging.
    fn name(&self) -> &str;
    fn extensions(&self) -> &[&str];
    fn parse_file(&self, path: &Path, content: &str) -> Result<ParseResult>;
}

pub struct ParseResult {
    pub nodes: Vec<CodeNode>,
    /// (caller_node_id, callee_name) pairs for building call edges
    pub calls: Vec<(String, String)>,
    /// Import paths (reserved for future cross-file resolution)
    #[allow(dead_code)]
    pub imports: Vec<String>,
}

pub struct ParserRegistry {
    parsers: Vec<Arc<dyn LanguageParser>>,
}

impl ParserRegistry {
    pub fn new() -> Self {
        Self {
            parsers: vec![Arc::new(rust::RustParser::new())],
        }
    }

    pub fn get_parser(&self, path: &Path) -> Option<&dyn LanguageParser> {
        let ext = path.extension()?.to_str()?;
        self.parsers
            .iter()
            .find(|p| p.extensions().contains(&ext))
            .map(|p| p.as_ref())
    }
}
