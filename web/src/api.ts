import type { GraphData, NodeDetail } from "./types";

const BASE = "/api";

export interface AppConfig {
  cli_backend: boolean;
}

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`);
  return res.json();
}

export async function fetchGraph(): Promise<GraphData> {
  const res = await fetch(`${BASE}/graph`);
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  return res.json();
}

export async function fetchNode(id: string): Promise<NodeDetail> {
  const res = await fetch(`${BASE}/node/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch node: ${res.status}`);
  return res.json();
}

export async function searchNodes(query: string): Promise<GraphData["nodes"]> {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Failed to search: ${res.status}`);
  return res.json();
}

export function streamChat(
  message: string,
  contextNodeIds: string[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context_node_ids: contextNodeIds }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Chat error: ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.done) {
                onDone();
                return;
              }
              onChunk(event.content);
            } catch {
              // skip malformed lines
            }
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== "AbortError") onError(err);
    });

  return controller;
}
