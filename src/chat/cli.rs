use anyhow::{Context, Result};
use futures::stream::{BoxStream, StreamExt};
use std::sync::{Arc, Mutex};
use tokio::{io::AsyncBufReadExt, process::Command};
use tokio_stream::wrappers::ReceiverStream;
use tracing::debug;

// ── Claude CLI ──────────────────────────────────────────────────────────

pub fn claude_is_available() -> bool {
    std::process::Command::new("claude")
        .arg("--version")
        .env_remove("CLAUDECODE")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
}

pub async fn claude_stream(
    system_prompt: &str,
    question: &str,
    model: Option<&str>,
    session_id: &Arc<Mutex<Option<String>>>,
    project_root: &std::path::Path,
) -> Result<BoxStream<'static, Result<String>>> {
    let prompt = format!("{system_prompt}\n\nUser question: {question}");
    let model = model.unwrap_or("claude-sonnet-4-20250514");

    let mut cmd = Command::new("claude");
    cmd.env_remove("CLAUDECODE")
        .current_dir(project_root)
        .arg("--print")
        .arg("--dangerously-skip-permissions")
        .arg("--verbose")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--model")
        .arg(model);

    {
        let session = session_id.lock().unwrap();
        if let Some(ref sid) = *session {
            debug!(session_id = %sid, "resuming claude session");
            cmd.arg("--resume").arg(sid);
        }
    }

    cmd.arg(&prompt)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

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
            let (sid, text) = parse_claude_json(&line);

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

        drain_and_wait(&mut child, "claude").await;
    });

    Ok(ReceiverStream::new(rx).boxed())
}

fn parse_claude_json(line: &str) -> (Option<String>, Option<String>) {
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
            let content = value
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array());
            let text = content.and_then(|blocks| {
                let parts: Vec<&str> = blocks
                    .iter()
                    .filter(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
                    .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                    .collect();
                if parts.is_empty() {
                    None
                } else {
                    Some(parts.join("\n"))
                }
            });
            (None, text)
        }
        _ => (None, None),
    }
}

// ── Codex CLI ───────────────────────────────────────────────────────────

pub fn codex_is_available() -> bool {
    std::process::Command::new("codex")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
}

pub async fn codex_stream(
    system_prompt: &str,
    question: &str,
    model: Option<&str>,
    session_id: &Arc<Mutex<Option<String>>>,
    project_root: &std::path::Path,
) -> Result<BoxStream<'static, Result<String>>> {
    let prompt = format!("{system_prompt}\n\nUser question: {question}");
    let mut cmd = Command::new("codex");

    {
        let session = session_id.lock().unwrap();
        if let Some(ref tid) = *session {
            debug!(thread_id = %tid, "resuming codex session");
            cmd.arg("exec").arg("resume").arg(tid);
        } else {
            cmd.arg("exec");
        }
    }

    cmd.arg("--json")
        .arg("--dangerously-bypass-approvals-and-sandbox");

    if let Some(model) = model {
        cmd.arg("-m").arg(model);
    }

    cmd.arg("-C")
        .arg(project_root)
        .arg(&prompt)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().context("failed to spawn codex CLI")?;
    let stdout = child
        .stdout
        .take()
        .context("failed to capture codex stdout")?;

    let reader = tokio::io::BufReader::new(stdout);
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<String>>(32);
    let session_id = Arc::clone(session_id);

    tokio::spawn(async move {
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let (tid, text) = parse_codex_json(&line);

            if let Some(tid) = tid {
                debug!(thread_id = %tid, "captured codex thread id");
                *session_id.lock().unwrap() = Some(tid);
            }

            if let Some(text) = text
                && tx.send(Ok(text)).await.is_err()
            {
                break;
            }
        }

        drain_and_wait(&mut child, "codex").await;
    });

    Ok(ReceiverStream::new(rx).boxed())
}

fn parse_codex_json(line: &str) -> (Option<String>, Option<String>) {
    let value: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => {
            if line.is_empty() {
                return (None, None);
            }
            return (None, Some(line.to_string()));
        }
    };

    let msg_type = match value.get("type").and_then(|t| t.as_str()) {
        Some(t) => t,
        None => return (None, None),
    };

    match msg_type {
        "thread.started" => {
            let tid = value
                .get("thread_id")
                .and_then(|v| v.as_str())
                .map(String::from);
            (tid, None)
        }
        "item.completed" => {
            let text = value
                .get("item")
                .and_then(|i| i.get("text"))
                .and_then(|t| t.as_str())
                .map(String::from);
            (None, text)
        }
        "error" => {
            let text = value
                .get("message")
                .and_then(|m| m.as_str())
                .map(|m| format!("Error: {m}"));
            (None, text)
        }
        _ => (None, None),
    }
}

// ── Shared ──────────────────────────────────────────────────────────────

async fn drain_and_wait(child: &mut tokio::process::Child, label: &str) {
    if let Some(mut stderr) = child.stderr.take() {
        let mut err_buf = String::new();
        let _ = tokio::io::AsyncReadExt::read_to_string(&mut stderr, &mut err_buf).await;
        if !err_buf.is_empty() {
            tracing::warn!(stderr = %err_buf, "{label} CLI stderr output");
        }
    }
    match child.wait().await {
        Ok(status) if !status.success() => {
            tracing::warn!(code = ?status.code(), "{label} CLI exited with non-zero status");
        }
        Err(e) => {
            tracing::error!(error = %e, "failed to wait on {label} CLI process");
        }
        _ => {}
    }
}
