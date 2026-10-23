import { useQuery } from "@tanstack/react-query";
import { Button } from "@mantine/core";
import { Link } from "react-router-dom";
import { Plus, ArrowRight, CheckCircle2 } from "lucide-react";
import { useSession } from "../../app/session";
import { demo, productName } from "../../shared/api/demo";
import type { Status } from "../../shared/api/types";
import { date, money, shortId } from "../../shared/format";
import {
  Empty,
  Metrics,
  PageTitle,
  Panel,
  QueryState,
  StatusBadge,
} from "../../components/ui/common";
import { ProductCards } from "../products/Products";
import { NewsCards } from "../news/News";
export function Progress({ status }: { status: Status }) {
  const index =
    status === "DRAFT"
      ? -1
      : status === "SUBMITTED"
        ? 0
        : status === "VERIFYING"
          ? 1
          : ["UNDER_REVIEW", "NEEDS_INFO"].includes(status)
            ? 2
            : 3;
  return (
    <div className="workflow-progress">
      {["Отправлена", "Проверки", "Рассмотрение", "Решение"].map((s, i) => (
        <div
          key={s}
          className={`${i <= index ? "done" : ""}${i === index ? " current" : ""}`}
        >
          <i />
          <span>{s}</span>
        </div>
      ))}
    </div>
  );
}
export function Dashboard() {
  const { session } = useSession();
  const q = useQuery({
    queryKey: ["applications", session?.username],
    queryFn: () => demo.applications(session!.username),
  });
  const a =
    q.data?.find(
      (a) => !["DRAFT", "COMPLETED", "REJECTED", "DECLINED"].includes(a.status),
    ) || q.data?.[0];
  return (
    <>
      <PageTitle
        title="Добрый день, Александр"
        subtitle="Ваши заявки и возможности для бизнеса"
        action={
          <Button
            component={Link}
            to="/client/applications/new"
            leftSection={<Plus size={16} />}
          >
            Новая заявка
          </Button>
        }
      />
      <QueryState query={q}>
        {a ? (
          <div className="dashboard-grid">
            <Panel className="current-application">
              <div className="row between">
                <span className="eyebrow">
                  ТЕКУЩАЯ ЗАЯВКА · №{shortId(a.id)}
                </span>
                <StatusBadge status={a.status} />
              </div>
              <h2>{productName(a.requested_terms.product_id)}</h2>
              <p>Обновлена {date(a.updated_at)}</p>
              <hr />
              <Metrics
                items={[
                  ["Сумма", money(a.requested_terms.amount)],
                  ["Срок", `${a.requested_terms.term_months} месяца`],
                ]}
              />
              <p className="progress-label">Ход рассмотрения</p>
              <Progress status={a.status} />
              <Button
                component={Link}
                to={`/client/applications/${a.id}`}
                variant="default"
              >
                Открыть заявку
              </Button>
            </Panel>
            <Panel className="next-step">
              <h3>Следующий шаг</h3>
              <span
                className={`status ${["NEEDS_INFO", "OFFERED", "DRAFT"].includes(a.status) ? "status-NEEDS_INFO" : "status-COMPLETED"}`}
              >
                <CheckCircle2 size={13} />
                {["NEEDS_INFO", "OFFERED", "DRAFT"].includes(a.status)
                  ? "Требуется действие"
                  : "Действий нет"}
              </span>
              <h3>{a.next_action}</h3>
              <p>
                {a.status === "UNDER_REVIEW"
                  ? "Автоматические проверки завершены. Заявка находится у сотрудника банка."
                  : "Все сведения и доступные действия находятся в карточке заявки."}
              </p>
              <hr />
              <small className="muted">Последнее событие</small>
              <p className="event-preview">
                {a.events.at(-1)?.reason} · {date(a.updated_at)}
              </p>
            </Panel>
          </div>
        ) : (
          <Panel>
            <Empty title="Ваша первая заявка">
              <p>Выберите продукт и расскажите о задачах бизнеса</p>
              <Button component={Link} to="/client/applications/new">
                Создать заявку
              </Button>
            </Empty>
          </Panel>
        )}
      </QueryState>
      <div className="section-title">
        <h2>Кредитные продукты</h2>
        <Link to="/client/products">
          Весь каталог <ArrowRight size={14} />
        </Link>
      </div>
      <ProductCards compact />
      <div className="section-title">
        <div>
          <h2>Полезное для бизнеса</h2>
          <p>Персональная подборка по отрасли компании</p>
        </div>
        <Link to="/client/news">
          Все новости <ArrowRight size={14} />
        </Link>
      </div>
      <NewsCards compact />
    </>
  );
}
