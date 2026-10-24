import { useLayoutEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
export function AssistantComposer({
  busy,
  disabled,
  contextKey,
  onSend,
}: {
  busy: boolean;
  disabled: boolean;
  contextKey: string;
  onSend: (text: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const input = useRef<HTMLTextAreaElement>(null);
  const text = drafts[contextKey] || "";
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 124)}px`;
  }, [text, contextKey]);
  function send() {
    if (busy || disabled || !text.trim()) return;
    onSend(text.trim());
    setDrafts((d) => ({ ...d, [contextKey]: "" }));
    input.current?.focus();
  }
  return (
    <footer className="credit-ai__composer">
      <form
        className="credit-ai__composer-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          className="credit-ai__textarea"
          aria-label="Вопрос помощнику"
          placeholder="Задайте кредитный вопрос…"
          value={text}
          onChange={(e) =>
            setDrafts((d) => ({ ...d, [contextKey]: e.target.value }))
          }
          rows={1}
          maxLength={3000}
          disabled={busy || disabled}
          data-autofocus
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="credit-ai__send"
          type="submit"
          aria-label="Отправить вопрос"
          disabled={busy || disabled || !text.trim()}
        >
          <Send />
        </button>
      </form>
      <p className="credit-ai__disclaimer">
        Информация справочная. Решение принимает банк
      </p>
      <span className="sr-only">
        Enter — отправка, Shift+Enter — новая строка.
      </span>
    </footer>
  );
}
