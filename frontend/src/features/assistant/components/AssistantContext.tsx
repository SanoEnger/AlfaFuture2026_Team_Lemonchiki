import { RefreshCw } from "lucide-react";
import { productName } from "../../../../shared/api/demo";
import { money, shortId, statuses } from "../../../../shared/format";
import type { AssistantContext as Context } from "../types";
export function AssistantContext({
  context,
  loading,
  error,
  onRefresh,
}: {
  context: Context;
  loading: boolean;
  error: Error | null;
  onRefresh: () => void;
}) {
  const application = "application" in context ? context.application : null;
  let title = "Общие вопросы по кредитам";
  let details = "Локальный справочный FAQ · без LLM";
  if (context.type === "product") {
    title = context.product.name;
    details = `${money(context.product.min_amount)}–${money(context.product.max_amount)} · ${context.product.min_term}–${context.product.max_term} мес.`;
  }
  if (application) {
    title = `Заявка №${shortId(application.id)} · ${productName(application.requested_terms.product_id)}`;
    details = `${statuses[application.status]} · ${money(application.requested_terms.amount)}`;
  }
  if (context.type === "documents" && !application) {
    title = "Документы";
    details = "Нет выбранной заявки. Можно задать общий вопрос.";
  }
  return (
    <section className="credit-ai__context" aria-label="Текущий контекст">
      <div className="credit-ai__context-top">
        <span className="credit-ai__context-label">
          {context.type === "offer"
            ? "Предложение банка"
            : context.type === "documents"
              ? "Документы"
              : "Текущий контекст"}
        </span>
        <button
          type="button"
          className="credit-ai__icon-button"
          aria-label="Обновить контекст"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {loading ? (
        <p className="credit-ai__context-title" role="status">
          Загружаем контекст…
        </p>
      ) : error ? (
        <div className="credit-ai__context-error">
          <p className="credit-ai__context-title">Контекст недоступен</p>
          <p>Заявка не найдена или демоданные временно недоступны.</p>
          <button
            className="credit-ai__retry"
            onClick={onRefresh}
            type="button"
          >
            Повторить загрузку
          </button>
        </div>
      ) : (
        <>
          <h3 className="credit-ai__context-title">{title}</h3>
          <div className="credit-ai__context-details">
            {application && (
              <span
                className="credit-ai__status-dot"
                data-status={
                  ["COMPLETED", "ACCEPTED"].includes(application.status)
                    ? "success"
                    : "active"
                }
                aria-hidden="true"
              />
            )}
            {details}
          </div>
        </>
      )}
    </section>
  );
}
