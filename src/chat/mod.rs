mod api;
pub mod claude;

use anyhow::{Result, bail};
use futures::stream::BoxStream;
use std::{
    env,
    sync::{Arc, Mutex},
};

use crate::cli::Backend;

/// Shared session state for backends that support session reuse (Claude CLI).
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

/// Send a message with code context. Returns a stream of text chunks.
pub async fn send_message(
    state: &ChatState,
    context: &str,
    question: &str,
) -> Result<BoxStream<'static, Result<String>>> {
    let system_prompt = format!(
        "You are a code assistant. The user is exploring a codebase and has selected \
         specific code entities as context. Answer their question based on this context.\n\n\
         ## Code Context\n{context}"
    );

    let backend = match &state.backend {
        Backend::Auto => resolve_auto()?,
        other => other.clone(),
    };

    match backend {
        Backend::ClaudeApi => {
            let key = env::var("ANTHROPIC_API_KEY")
                .map_err(|_| anyhow::anyhow!("ANTHROPIC_API_KEY not set"))?;
            let model = state.model.as_deref().unwrap_or("claude-sonnet-4-20250514");
            api::stream_anthropic(&key, model, &system_prompt, question).await
        }
        Backend::ClaudeCli => {
            if !claude::is_available() {
                bail!("claude CLI not found in PATH");
            }
            claude::stream_message(
                &system_prompt,
                question,
                state.model.as_deref(),
                &state.session_id,
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
                .unwrap_or_else(|| env::var("OPENAI_MODEL").unwrap_or_else(|_| "codex-5.3".into()));
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
    if claude::is_available() {
        return Ok(Backend::ClaudeCli);
    }
    bail!(
        "no chat backend available. Set OPENAI_API_BASE (local models), \
         ANTHROPIC_API_KEY, or install the Claude CLI."
    )
}
