use anyhow::{Context, Result};
use std::{fs, path::Path};

use super::CodeGraph;

/// Return the storage path for a project's graph inside the codewiki data dir.
/// Format: `<codewiki_data_dir>/graph-<project_name>.json`
fn graph_path(project_root: &Path) -> Result<std::path::PathBuf> {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("codewiki");
    fs::create_dir_all(&data_dir).context("failed to create codewiki data directory")?;

    let project_name = project_root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unnamed".to_string());

    Ok(data_dir.join(format!("graph-{project_name}.json")))
}

pub fn save(project_root: &Path, graph: &CodeGraph) -> Result<()> {
    let path = graph_path(project_root)?;
    let json = serde_json::to_string(graph).context("failed to serialize graph")?;
    fs::write(&path, json).with_context(|| format!("failed to write {}", path.display()))?;
    tracing::info!("saved graph to {}", path.display());

    Ok(())
}
