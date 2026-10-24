import { useEffect, useState } from "react";
export function AssistantQuickQuestions({
  questions,
  busy,
  selected,
  onQuestion,
}: {
  questions: string[];
  busy: boolean;
  selected?: string;
  onQuestion: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    setExpanded(!selected);
  }, [selected]);
  return (
    <section className="credit-ai__shortcuts" aria-label="Быстрые вопросы">
      <button
        className="credit-ai__questions-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        Популярные вопросы {expanded ? "−" : "+"}
      </button>
      <div className="credit-ai__shortcut-list" hidden={!expanded}>
        {questions.slice(0, 3).map((q) => (
          <button
            className="credit-ai__shortcut"
            type="button"
            key={q}
            disabled={busy}
            aria-pressed={selected === q}
            onClick={() => onQuestion(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
