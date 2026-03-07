use anyhow::{Context, Result};
use futures::stream::{BoxStream, StreamExt};
use reqwest::{Client, Response};
use tokio_stream::wrappers::ReceiverStream;

/// Stream from Anthropic Messages API.
pub async fn stream_anthropic(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    question: &str,
) -> Result<BoxStream<'static, Result<String>>> {
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": [{"role": "user", "content": question}],
        "stream": true,
    });

    let response = Client::new()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .context("failed to connect to Anthropic API")?;

    check_status(response, "Anthropic", |data| {
        let v: serde_json::Value = serde_json::from_str(data).ok()?;
        if v.get("type")?.as_str()? != "content_block_delta" {
            return None;
        }
        v.get("delta")?.get("text")?.as_str().map(String::from)
    })
    .await
}

/// Stream from OpenAI-compatible API (Ollama, LM Studio, vLLM, etc.).
pub async fn stream_openai(
    base_url: &str,
    api_key: Option<&str>,
    model: &str,
    system_prompt: &str,
    question: &str,
) -> Result<BoxStream<'static, Result<String>>> {
    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        "stream": true,
    });

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let mut req = Client::new()
        .post(&url)
        .header("content-type", "application/json");

    if let Some(key) = api_key {
        req = req.header("authorization", format!("Bearer {key}"));
    }

    let response = req
        .json(&body)
        .send()
        .await
        .with_context(|| format!("failed to connect to {url}"))?;

    check_status(response, "OpenAI-compatible", |data| {
        let v: serde_json::Value = serde_json::from_str(data).ok()?;
        let text = v
            .get("choices")?
            .as_array()?
            .first()?
            .get("delta")?
            .get("content")?
            .as_str()?;
        if text.is_empty() {
            return None;
        }
        Some(text.to_string())
    })
    .await
}

/// Check HTTP status, then stream SSE data through `extract` to pull text chunks.
async fn check_status(
    response: Response,
    label: &str,
    extract: impl Fn(&str) -> Option<String> + Send + 'static,
) -> Result<BoxStream<'static, Result<String>>> {
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("{label} API error {status}: {body}");
    }
    stream_sse(response, extract)
}

/// Shared SSE stream parser. Calls `extract` for each `data:` line to pull text.
fn stream_sse(
    response: Response,
    extract: impl Fn(&str) -> Option<String> + Send + 'static,
) -> Result<BoxStream<'static, Result<String>>> {
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<String>>(32);

    tokio::spawn(async move {
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = match chunk {
                Ok(c) => c,
                Err(e) => {
                    let _ = tx.send(Err(e.into())).await;
                    break;
                }
            };

            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(pos) = buffer.find('\n') {
                let line: String = buffer[..pos].trim().into();
                buffer.drain(..pos + 1);

                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        return;
                    }
                    if let Some(text) = extract(data)
                        && tx.send(Ok(text)).await.is_err()
                    {
                        return;
                    }
                }
            }
        }
    });

    Ok(ReceiverStream::new(rx).boxed())
}
