use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Sse, sse::Event},
    routing::{get, post},
};
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};

use crate::{chat, graph::FileEntry};

#[derive(Serialize)]
struct ConfigResponse {
    /// Whether the backend supports tool-use (CLI backends can explore the project without context).
    cli_backend: bool,
}

async fn get_config(State(state): State<Arc<AppState>>) -> Json<ConfigResponse> {
    Json(ConfigResponse {
        cli_backend: chat::is_cli_backend(&state.chat.backend),
    })
}

use super::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/graph", get(get_graph))
        .route("/node/{*id}", get(get_node))
        .route("/search", get(search_nodes))
        .route("/chat", post(chat_handler))
        .route("/config", get(get_config))
}

#[derive(Serialize)]
struct GraphResponse {
    nodes: Vec<NodeResponse>,
    edges: Vec<EdgeResponse>,
    file_tree: Vec<FileEntry>,
}

#[derive(Serialize)]
struct NodeResponse {
    id: String,
    name: String,
    kind: String,
    file_path: String,
    language: String,
    start_line: usize,
    end_line: usize,
    visibility: Option<String>,
    children: Vec<String>,
    parent: Option<String>,
}

#[derive(Serialize)]
struct EdgeResponse {
    from: String,
    to: String,
    kind: String,
}

fn node_kind_str(kind: crate::graph::NodeKind) -> &'static str {
    match kind {
        crate::graph::NodeKind::File => "file",
        crate::graph::NodeKind::Module => "module",
        crate::graph::NodeKind::Function => "function",
        crate::graph::NodeKind::Struct => "struct",
        crate::graph::NodeKind::Enum => "enum",
        crate::graph::NodeKind::Trait => "trait",
        crate::graph::NodeKind::Impl => "impl",
        crate::graph::NodeKind::Constant => "constant",
        crate::graph::NodeKind::TypeAlias => "type_alias",
        crate::graph::NodeKind::Class => "class",
    }
}

fn edge_kind_str(kind: crate::graph::EdgeKind) -> &'static str {
    match kind {
        crate::graph::EdgeKind::Contains => "contains",
        crate::graph::EdgeKind::Calls => "calls",
        crate::graph::EdgeKind::Imports => "imports",
        crate::graph::EdgeKind::Implements => "implements",
    }
}

fn to_node_response(n: &crate::graph::CodeNode) -> NodeResponse {
    NodeResponse {
        id: n.id.clone(),
        name: n.name.clone(),
        kind: node_kind_str(n.kind).to_string(),
        file_path: n.file_path.clone(),
        language: n.language.clone(),
        start_line: n.span.start_line,
        end_line: n.span.end_line,
        visibility: n.visibility.clone(),
        children: n.children.clone(),
        parent: n.parent.clone(),
    }
}

async fn get_graph(State(state): State<Arc<AppState>>) -> Json<GraphResponse> {
    let graph = &state.graph;

    let nodes: Vec<NodeResponse> = graph.nodes.values().map(to_node_response).collect();

    let edges: Vec<EdgeResponse> = graph
        .edges
        .iter()
        .map(|e| EdgeResponse {
            from: e.from.clone(),
            to: e.to.clone(),
            kind: edge_kind_str(e.kind).to_string(),
        })
        .collect();

    Json(GraphResponse {
        nodes,
        edges,
        file_tree: graph.file_tree.clone(),
    })
}

#[derive(Serialize)]
struct NodeDetailResponse {
    id: String,
    name: String,
    kind: String,
    file_path: String,
    language: String,
    start_line: usize,
    end_line: usize,
    body: String,
    visibility: Option<String>,
    children: Vec<String>,
    parent: Option<String>,
}

async fn get_node(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<NodeDetailResponse>, StatusCode> {
    let node = state.graph.nodes.get(&id).ok_or(StatusCode::NOT_FOUND)?;

    let body = if node.kind == crate::graph::NodeKind::File && node.body.is_empty() {
        let file_path = state.project_root.join(&node.file_path);
        match std::fs::read_to_string(&file_path) {
            Ok(content) => content,
            Err(e) => {
                tracing::warn!(path = %file_path.display(), error = %e, "failed to read file for code panel");
                String::new()
            }
        }
    } else {
        node.body.clone()
    };

    Ok(Json(NodeDetailResponse {
        id: node.id.clone(),
        name: node.name.clone(),
        kind: node_kind_str(node.kind).to_string(),
        file_path: node.file_path.clone(),
        language: node.language.clone(),
        start_line: node.span.start_line,
        end_line: node.span.end_line,
        body,
        visibility: node.visibility.clone(),
        children: node.children.clone(),
        parent: node.parent.clone(),
    }))
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
}

async fn search_nodes(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchQuery>,
) -> Json<Vec<NodeResponse>> {
    let results = state.graph.search(&params.q);

    let nodes: Vec<NodeResponse> = results.into_iter().take(50).map(to_node_response).collect();

    Json(nodes)
}

#[derive(Deserialize)]
struct ChatRequest {
    message: String,
    context_node_ids: Vec<String>,
}

#[derive(Serialize)]
struct ChatEvent {
    content: String,
    done: bool,
}

async fn chat_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl futures::Stream<Item = Result<Event, std::convert::Infallible>>>, StatusCode> {
    let mut context = String::new();
    for node_id in &req.context_node_ids {
        if let Some(node) = state.graph.nodes.get(node_id) {
            context.push_str(&format!(
                "## {} ({}) — {}\n```{}\n{}\n```\n\n",
                node.name,
                node_kind_str(node.kind),
                node.file_path,
                node.language,
                node.body
            ));
        }
    }

    let stream = chat::send_message(&state.chat, &context, &req.message, &state.project_root)
        .await
        .map_err(|e| {
            tracing::error!("chat error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let sse_stream = stream.map(|chunk| {
        let event = match chunk {
            Ok(text) => {
                let data = serde_json::to_string(&ChatEvent {
                    content: text,
                    done: false,
                })
                .unwrap_or_else(|e| {
                    tracing::warn!(error = %e, "failed to serialize chat event");
                    String::new()
                });
                Event::default().data(data)
            }
            Err(_) => {
                let data = serde_json::to_string(&ChatEvent {
                    content: String::new(),
                    done: true,
                })
                .unwrap_or_else(|e| {
                    tracing::warn!(error = %e, "failed to serialize chat done event");
                    String::new()
                });
                Event::default().data(data)
            }
        };
        Ok(event)
    });

    Ok(Sse::new(sse_stream))
}
