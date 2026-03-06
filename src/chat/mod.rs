mod api;
mod cli;

use anyhow::{Result, bail};
use futures::stream::BoxStream;
use std::{
    env,
    path::Path,
    sync::{Arc, Mutex},
};

use crate::cli::Backend;

pub struct ChatState {
    pub backend: Backend,
    pub model: Option<String>,
    pub session_id: Arc<Mutex<Option<String>>>,
}

impl ChatState {
    pub fn new(backend: Backend, model: Option<String>) -> Self {
        Self {
            backend,
            model,
            session_id: Arc::new(Mutex::new(None)),
        }
    }
}

pub fn resolve_backend(backend: &Backend) -> Result<Backend> {
    match backend {
        Backend::Auto => resolve_auto(),
        other => Ok(other.clone()),
    }
}

pub fn is_cli_backend(backend: &Backend) -> bool {
    match backend {
        Backend::ClaudeCli | Backend::CodexCli => true,
        Backend::Auto => {
            resolve_auto().is_ok_and(|b| matches!(b, Backend::ClaudeCli | Backend::CodexCli))
        }
        _ => false,
    }
}

pub async fn send_message(
    state: &ChatState,
    context: &str,
    question: &str,
    project_root: &Path,
) -> Result<BoxStream<'static, Result<String>>> {
    let backend = resolve_backend(&state.backend)?;

    let has_context = !context.is_empty();
    let is_cli = matches!(backend, Backend::ClaudeCli | Backend::CodexCli);

    let system_prompt = if has_context {
        format!(
            "You are a code assistant. The user is exploring a codebase and has selected \
             specific code entities as context. Answer their question based on this context.\n\n\
             ## Code Context\n{context}"
        )
    } else if is_cli {
        format!(
            "You are a code assistant. The user is exploring a codebase at {}. \
             No specific code context was selected — use your tools to read files \
             and explore the project to answer the question.",
            project_root.display()
        )
    } else {
        bail!("no code context selected — select nodes before chatting with an API backend")
    };

    match backend {
        Backend::ClaudeApi => {
            let key = env::var("ANTHROPIC_API_KEY")
                .map_err(|_| anyhow::anyhow!("ANTHROPIC_API_KEY not set"))?;
            let model = state.model.as_deref().unwrap_or("claude-sonnet-4-20250514");
            api::stream_anthropic(&key, model, &system_prompt, question).await
        }
        Backend::ClaudeCli => {
            if !cli::claude_is_available() {
                bail!("claude CLI not found in PATH");
            }
            cli::claude_stream(
                &system_prompt,
                question,
                state.model.as_deref(),
                &state.session_id,
                project_root,
            )
            .await
        }
        Backend::CodexCli => {
            if !cli::codex_is_available() {
                bail!("codex CLI not found in PATH");
            }
            cli::codex_stream(
                &system_prompt,
                question,
                state.model.as_deref(),
                &state.session_id,
                project_root,
            )
            .await
        }
        Backend::Openai => {
            let base = env::var("OPENAI_API_BASE")
                .map_err(|_| anyhow::anyhow!("OPENAI_API_BASE not set"))?;
            let key = env::var("OPENAI_API_KEY").ok();
            let model = state
                .model
                .clone()
                .unwrap_or_else(|| env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4.1".into()));
            api::stream_openai(&base, key.as_deref(), &model, &system_prompt, question).await
        }
        Backend::Auto => unreachable!(),
    }
}

fn resolve_auto() -> Result<Backend> {
    if env::var("OPENAI_API_BASE").is_ok() {
        return Ok(Backend::Openai);
    }
    if env::var("ANTHROPIC_API_KEY").is_ok() {
        return Ok(Backend::ClaudeApi);
    }
    if cli::claude_is_available() {
        return Ok(Backend::ClaudeCli);
    }
    if cli::codex_is_available() {
        return Ok(Backend::CodexCli);
    }
    bail!(
        "no chat backend available. Set OPENAI_API_BASE (local models), \
         ANTHROPIC_API_KEY, or install the Claude or Codex CLI."
    )
}
