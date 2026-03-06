import { useState, useCallback } from "react";
import { streamChat } from "../api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMessage = useCallback(
    (text: string, contextNodeIds: string[]) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "" },
      ]);

      const assistantIdx = messages.length + 1;

      streamChat(
        text,
        contextNodeIds,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const msg = updated[assistantIdx];
            if (msg?.role === "assistant") {
              updated[assistantIdx] = { ...msg, content: msg.content + chunk };
            }
            return updated;
          });
        },
        () => {},
        (err) => {
          setMessages((prev) => {
            const updated = [...prev];
            const msg = updated[assistantIdx];
            if (msg?.role === "assistant" && msg.content === "") {
              updated[assistantIdx] = { ...msg, content: `Error: ${err.message}` };
            } else {
              updated.push({ role: "assistant", content: `Error: ${err.message}` });
            }
            return updated;
          });
        },
      );
    },
    [messages.length],
  );

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, clear };
}
