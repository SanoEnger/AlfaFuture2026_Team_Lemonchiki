import { useEffect, useRef, useState } from "react";
import type {
  AssistantContext,
  AssistantMessage,
  AssistantService,
} from "../types";
import { localAssistantService } from "../assistantContent";

export function useAssistantChat(
  context: AssistantContext,
  service: AssistantService = localAssistantService,
) {
  const [threads, setThreads] = useState<Record<string, AssistantMessage[]>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<{
    key: string;
    id: string;
    controller: AbortController;
  } | null>(null);
  function update(key: string, id: string, changes: Partial<AssistantMessage>) {
    setThreads((t) => ({
      ...t,
      [key]: (t[key] || []).map((m) =>
        m.messageId === id ? { ...m, ...changes } : m,
      ),
    }));
  }
  function cancel() {
    const job = pending.current;
    if (!job) return;
    job.controller.abort();
    pending.current = null;
    setBusy(false);
    update(job.key, job.id, {
      status: "error",
      text: "Запрос остановлен при смене контекста. Можно повторить его в этом диалоге.",
    });
  }
  useEffect(() => {
    setAnnouncement("");
    return cancel;
  }, [context.contextKey]);
  async function request(question: string, retryId?: string) {
    if (pending.current || !question.trim()) return;
    const key = context.contextKey;
    const id = retryId || crypto.randomUUID();
    const controller = new AbortController();
    const common = {
      contextKey: key,
      createdAt: new Date().toISOString(),
      sources: [],
      actions: [],
    };
    if (retryId) update(key, id, { status: "pending", text: "" });
    else
      setThreads((t) => ({
        ...t,
        [key]: [
          ...(t[key] || []),
          {
            ...common,
            messageId: crypto.randomUUID(),
            role: "user",
            text: question,
            status: "success",
          },
          {
            ...common,
            messageId: id,
            role: "assistant",
            text: "",
            status: "pending",
            prompt: question,
          },
        ],
      }));
    pending.current = { key, id, controller };
    setBusy(true);
    setAnnouncement("Подготовка справки по локальным данным.");
    try {
      const response = await service.respond(
        context,
        question,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      update(key, id, {
        ...response,
        status: "success",
        createdAt: new Date().toISOString(),
      });
      setAnnouncement(`Помощник: ${response.text}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      update(key, id, {
        status: "error",
        text: "Не удалось получить данные с сервера. Проверьте их доступность и повторите запрос.",
      });
      setAnnouncement(
        "Не удалось подготовить ответ. Доступна повторная попытка.",
      );
    } finally {
      if (pending.current?.id === id) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return {
    messages: threads[context.contextKey] || [],
    busy,
    announcement,
    send: (text: string) => request(text.trim()),
    retry: (message: AssistantMessage) =>
      request(message.prompt || "", message.messageId),
  };
}
