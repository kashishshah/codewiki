mod chat;
mod cli;
mod graph;
mod parser;
mod server;

use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;
use tracing::info;
use tracing_subscriber::EnvFilter;

use crate::{
    cli::{Cli, Command},
    graph::CodeGraph,
    parser::ParserRegistry,
};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("codewiki=info")),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Command::Index { path } => {
            let (graph, _) = index_project(path)?;
            println!(
                "indexed {} nodes, {} edges",
                graph.nodes.len(),
                graph.edges.len()
            );
        }
        Command::Serve {
            path,
            port,
            no_open,
            backend,
            model,
        } => {
            let (graph, _) = index_project(path)?;
            info!(
                "indexed {} nodes, {} edges",
                graph.nodes.len(),
                graph.edges.len()
            );
            server::serve(graph, port, no_open, backend, model).await?;
        }
    }

    Ok(())
}

fn index_project(path: PathBuf) -> Result<(CodeGraph, PathBuf)> {
    let path = path.canonicalize()?;
    info!("indexing {}", path.display());

    let registry = ParserRegistry::new();
    let graph = CodeGraph::from_directory(&path, &registry)?;
    graph::store::save(&path, &graph)?;

    Ok((graph, path))
}
