mod api;

use anyhow::Result;
use axum::Router;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
};
use tracing::info;

use crate::{chat::ChatState, cli::Backend, graph::CodeGraph};

pub struct AppState {
    pub graph: CodeGraph,
    pub chat: ChatState,
    pub project_root: std::path::PathBuf,
}

pub async fn serve(
    graph: CodeGraph,
    port: u16,
    backend: Backend,
    model: Option<String>,
    project_root: std::path::PathBuf,
) -> Result<()> {
    let state = Arc::new(AppState {
        graph,
        chat: ChatState::new(backend, model),
        project_root,
    });
    let dist_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("web/dist");
    let spa =
        ServeDir::new(&dist_dir).not_found_service(ServeFile::new(dist_dir.join("index.html")));

    let app = Router::new()
        .nest("/api", api::routes())
        .fallback_service(spa)
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(&addr).await?;
    let url = format!("http://localhost:{port}");

    info!("serving at {url}");
    println!("codewiki running at {url}");

    axum::serve(listener, app).await?;

    Ok(())
}
