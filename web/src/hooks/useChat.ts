import { useState, useCallback, useRef } from "react";
import { streamChat } from "../api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback((text: string, contextNodeIds: string[]) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    controllerRef.current = streamChat(
      text,
      contextNodeIds,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      },
      () => setStreaming(false),
      (err) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
        setStreaming(false);
      },
    );
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, streaming, sendMessage, cancel, clear };
}
