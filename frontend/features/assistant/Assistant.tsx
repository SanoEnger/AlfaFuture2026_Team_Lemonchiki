import { useState } from "react";
import { Drawer, Button, TextInput, ActionIcon } from "@mantine/core";
import { Send, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useMediaQuery } from "@mantine/hooks";
const faq = [
  [
    "Какой кредит выбрать?",
    "Для закупок и текущих расходов подходит оборотный кредит. Для оборудования и развития — инвестиционный. Сравните условия в каталоге продуктов.",
  ],
  [
    "Как выбрать сумму и срок?",
    "Сопоставьте ежемесячный платёж со свободным денежным потоком. В мастере заявки указаны ограничения выбранного продукта.",
  ],
  [
    "Какие документы нужны?",
    "В демо можно добавить PDF до 5 МБ. Если банк запросил уточнение, перечень нужных сведений появится в карточке заявки.",
  ],
  [
    "Что означает статус?",
    "«На рассмотрении» — проверки завершены, ожидается решение сотрудника. «Нужны сведения» — ответьте на запрос. «Предложение банка» — сравните условия и примите решение.",
  ],
  [
    "Чем предложение отличается от запроса?",
    "Запрошенные сумма и срок сохраняются отдельно. Банк может предложить другую сумму, срок и ставку. Сравнение доступно в карточке заявки.",
  ],
];
export function Assistant({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ text: string; user: boolean }[]>(
    [],
  );
  const location = useLocation();
  const desktop = useMediaQuery("(min-width: 1280px)");
  const mobile = useMediaQuery("(max-width: 768px)");
  const context = location.pathname.includes("/applications/")
    ? "Кредитная заявка"
    : location.pathname.includes("products")
      ? "Выбор продукта"
      : location.pathname.includes("documents")
        ? "Документы"
        : "Кредитный кабинет";
  const questions = [...faq].sort(([a], [b]) => {
    const relevant = (q: string) =>
      location.pathname.includes("documents")
        ? q.includes("документы")
        : location.pathname.includes("/applications/")
          ? q.includes("предложение") || q.includes("статус")
          : q.includes("кредит");
    return Number(relevant(b)) - Number(relevant(a));
  });
  function ask(text: string) {
    if (!text.trim()) return;
    const answer =
      faq.find(
        ([q]) =>
          q === text ||
          text.toLowerCase().includes(q.split(" ")[1].toLowerCase()),
      )?.[1] ||
      "Я могу объяснить выбор продукта, документы, статусы и предложение банка. Выберите одну из подсказок. Это локальный FAQ-помощник; решения по кредиту принимает сотрудник банка.";
    setMessages((m) => [
      ...m,
      { text, user: true },
      { text: answer, user: false },
    ]);
    setInput("");
  }
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={mobile ? "100%" : 380}
      className="credit-assistant"
      withOverlay={!desktop}
      lockScroll={!desktop}
      trapFocus={!desktop}
      title={
        <strong className="icon-label">
          <Sparkles size={18} /> AI-помощник
        </strong>
      }
    >
      <div className="assistant-body">
        <span className="status">Демо · Локальный FAQ</span>
        <h2>Чем помочь?</h2>
        <p>Подскажу по заявке и условиям. Финальное решение принимает банк.</p>
        <small className="muted">Контекст: {context}</small>
        <div className="faq">
          {questions.map(([q]) => (
            <Button variant="default" key={q} onClick={() => ask(q)}>
              {q}
            </Button>
          ))}
        </div>
        <div className="messages" aria-live="polite">
          {messages.map((m, i) => (
            <p className={m.user ? "message user" : "message"} key={i}>
              {m.text}
            </p>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="assistant-input"
        >
          <TextInput
            aria-label="Сообщение помощнику"
            placeholder="Задайте вопрос…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rightSection={
              <ActionIcon
                type="submit"
                aria-label="Отправить вопрос"
                disabled={!input.trim()}
              >
                <Send size={16} />
              </ActionIcon>
            }
          />
        </form>
      </div>
    </Drawer>
  );
}
