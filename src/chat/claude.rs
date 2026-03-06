use anyhow::{Context, Result};
use futures::stream::{BoxStream, StreamExt};
use std::sync::{Arc, Mutex};
use tokio::{io::AsyncBufReadExt, process::Command};
use tokio_stream::wrappers::ReceiverStream;
use tracing::debug;

/// Check if the Claude CLI is installed.
pub fn is_available() -> bool {
    std::process::Command::new("claude")
        .arg("--version")
        .env_remove("CLAUDECODE")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
}

pub async fn stream_message(
    system_prompt: &str,
    question: &str,
    model: Option<&str>,
    session_id: &Arc<Mutex<Option<String>>>,
    project_root: &std::path::Path,
) -> Result<BoxStream<'static, Result<String>>> {
    let prompt = format!("{system_prompt}\n\nUser question: {question}");

    let mut cmd = Command::new("claude");
    cmd.env_remove("CLAUDECODE")
        .current_dir(project_root)
        .arg("--print")
        .arg("--verbose")
        .arg("--output-format")
        .arg("stream-json");

    if let Some(model) = model {
        cmd.arg("--model").arg(model);
    }

    {
        let session = session_id.lock().unwrap();
        if let Some(ref sid) = *session {
            debug!(session_id = %sid, "resuming claude session");
            cmd.arg("--resume").arg(sid);
        }
    }

    cmd.arg(&prompt)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());

    let mut child = cmd.spawn().context("failed to spawn claude CLI")?;

    let stdout = child
        .stdout
        .take()
        .context("failed to capture claude stdout")?;

    let reader = tokio::io::BufReader::new(stdout);
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<String>>(32);
    let session_id = Arc::clone(session_id);

    tokio::spawn(async move {
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let (sid, text) = parse_stream_json(&line);

            if let Some(sid) = sid {
                debug!(session_id = %sid, "captured claude session id");
                *session_id.lock().unwrap() = Some(sid);
            }

            if let Some(text) = text
                && tx.send(Ok(text)).await.is_err()
            {
                break;
            }
        }

        let _ = child.wait().await;
    });

    Ok(ReceiverStream::new(rx).boxed())
}

/// Parse a stream-json line from Claude CLI.
/// Returns (session_id, displayable_text).
fn parse_stream_json(line: &str) -> (Option<String>, Option<String>) {
    let value: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return (None, None),
    };

    let msg_type = match value.get("type").and_then(|t| t.as_str()) {
        Some(t) => t,
        None => return (None, None),
    };

    match msg_type {
        "system" | "result" => {
            let sid = value
                .get("session_id")
                .and_then(|v| v.as_str())
                .map(String::from);
            (sid, None)
        }
        "assistant" => {
            let text = extract_assistant_text(&value);
            (None, text)
        }
        _ => (None, None),
    }
}

/// Extract text content from an assistant message's content blocks.
fn extract_assistant_text(value: &serde_json::Value) -> Option<String> {
    let content = value.get("message")?.get("content")?.as_array()?;
    let mut parts = Vec::new();
    for block in content {
        if block.get("type").and_then(|t| t.as_str()) == Some("text")
            && let Some(text) = block.get("text").and_then(|t| t.as_str())
        {
            parts.push(text);
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}
