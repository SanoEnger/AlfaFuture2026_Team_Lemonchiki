import type { Application } from "../../shared/api/types";
import { shortId, date } from "../../shared/format";
export function DocumentChecklist({
  application: a,
}: {
  application: Application;
}) {
  const requests = a.information_requests.filter((r) => r.status === "OPEN");
  return (
    <div className="document-checklist" aria-label="Состояние документов">
      <p className="muted">
        Комплект по заявке №{shortId(a.id)} · {a.documents.length} файлов
      </p>
      {requests.map((r) => (
        <div className="checklist-item" key={r.id}>
          <strong>Требуется ответ на запрос</strong>
          <p>{r.message}</p>
          <small>
            Запрос от {date(r.created_at)}. Добавьте файл или уточнения и явно
            отправьте ответ банку.
          </small>
        </div>
      ))}
      {!requests.length && <p>Действующих запросов банка нет.</p>}
      {a.documents.length > 0 && (
        <p>
          Файлы добавлены к заявке. Статус проверки отдельных файлов в API не
          указан.
        </p>
      )}
    </div>
  );
}
