use anyhow::{Context, Result};
use std::{fs, path::Path};

use super::CodeGraph;

const STORE_DIR: &str = ".codewiki";
const GRAPH_FILE: &str = "graph.json";

pub fn save(project_root: &Path, graph: &CodeGraph) -> Result<()> {
    let dir = project_root.join(STORE_DIR);
    fs::create_dir_all(&dir).context("failed to create .codewiki directory")?;

    let path = dir.join(GRAPH_FILE);
    let json = serde_json::to_string(graph).context("failed to serialize graph")?;
    fs::write(&path, json).context("failed to write graph.json")?;

    Ok(())
}
