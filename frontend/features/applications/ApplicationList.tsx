import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Select, TextInput, Pagination } from "@mantine/core";
import { identity } from "../../shared/api/identity";
import { Plus, Search, ArrowUpDown, ArrowUpRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "../../app/session";
import { productName, products } from "../../shared/api/demo";
import { data as demo } from "../../shared/api/data";
import { date, money, shortId, statuses } from "../../shared/format";
import {
  Empty,
  PageTitle,
  Panel,
  QueryState,
  StatusBadge,
} from "../../components/ui/common";
export function ApplicationList({ bank = false }: { bank?: boolean }) {
  const { session } = useSession();
  const [params] = useSearchParams();
  const view = bank ? params.get("view") : null;
  const viewTitle =
    view === "review"
      ? "Рассмотрение"
      : view === "history"
        ? "История решений"
        : "Очередь заявок";
  const q = useQuery({
    queryKey: ["applications", bank ? "bank" : session?.username],
    queryFn: () => demo.applications(bank ? undefined : session!.username),
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>("");
  const [product, setProduct] = useState<string | null>("");
  const [risk, setRisk] = useState<string | null>("");
  const [asc, setAsc] = useState(false);
  const [assignment, setAssignment] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [search, status, product, risk, view, assignment]);
  useEffect(() => {
    setSearch("");
    setStatus("");
    setProduct("");
    setRisk("");
  }, [view]);
  const list =
    q.data
      ?.filter(
        (a) =>
          (view !== "review" || a.status === "UNDER_REVIEW") &&
          (view !== "history" ||
            [
              "OFFERED",
              "REJECTED",
              "ACCEPTED",
              "DECLINED",
              "COMPLETED",
            ].includes(a.status)) &&
          (!bank || a.status !== "DRAFT") &&
          (!assignment ||
            (assignment === "mine"
              ? a.assigned_officer_id === session?.username
              : !a.assigned_officer_id)) &&
          (!status || a.status === status) &&
          (!product || a.requested_terms.product_id === product) &&
          (!risk || a.risk?.risk_level === risk) &&
          `${a.id} ${a.company.legal_name} ${a.company.inn} ${productName(a.requested_terms.product_id)}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort(
        (a, b) => (asc ? 1 : -1) * a.updated_at.localeCompare(b.updated_at),
      ) || [];
  return (
    <>
      <PageTitle
        title={bank ? viewTitle : "Мои заявки"}
        subtitle={
          bank
            ? "Рассмотрение кредитных заявок и принятие решений"
            : "Все обращения и актуальные статусы в одном месте"
        }
        action={
          !bank && (
            <Button
              component={Link}
              to="/client/applications/new"
              leftSection={<Plus size={16} />}
            >
              Новая заявка
            </Button>
          )
        }
      />
      {bank && (
        <div className="queue-stats">
          {[
            ["Всего заявок", q.data?.length || 0],
            [
              "На рассмотрении",
              q.data?.filter((a) => a.status === "UNDER_REVIEW").length || 0,
            ],
            [
              "Ожидают уточнения",
              q.data?.filter((a) => a.status === "NEEDS_INFO").length || 0,
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      )}
      <Panel className="table-panel">
        <div className="filters">
          <TextInput
            aria-label="Поиск заявок"
            placeholder={
              bank ? "Компания, ИНН или номер" : "Поиск по номеру заявки"
            }
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            aria-label="Статус"
            placeholder="Все статусы"
            clearable
            value={status}
            onChange={setStatus}
            data={Object.entries(statuses).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          {bank ? (
            <Select
              aria-label="Уровень риска"
              placeholder="Любой риск"
              clearable
              value={risk}
              onChange={setRisk}
              data={["LOW", "MEDIUM", "HIGH"]}
            />
          ) : (
            <Select
              aria-label="Продукт"
              placeholder="Все продукты"
              clearable
              value={product}
              onChange={setProduct}
              data={products.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
          {bank && (
            <Select
              aria-label="Ответственный"
              placeholder="Все назначения"
              clearable
              value={assignment}
              onChange={setAssignment}
              data={[
                { value: "mine", label: "Назначено мне" },
                { value: "free", label: "Не назначено" },
              ]}
            />
          )}
        </div>
        <QueryState query={q}>
          {list.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{bank ? "Компания / заявка" : "Заявка / продукт"}</th>
                    <th className="numeric-cell">Сумма / срок</th>
                    <th>Статус</th>
                    {bank && <th>Риск</th>}
                    {bank && <th>Ответственный</th>}
                    <th>
                      <button
                        className="sort-button"
                        onClick={() => setAsc(!asc)}
                      >
                        Обновлена <ArrowUpDown size={13} />
                      </button>
                    </th>
                    <th aria-label="Действия" />
                  </tr>
                </thead>
                <tbody>
                  {list.slice((page - 1) * 20, page * 20).map((a) => (
                    <tr key={a.id}>
                      <td data-label="Заявка">
                        <Link
                          className="table-primary"
                          to={`${bank ? "/bank" : "/client"}/applications/${a.id}`}
                        >
                          {bank ? a.company.legal_name : `№${shortId(a.id)}`}
                        </Link>
                        <small>
                          {bank
                            ? `№${shortId(a.id)} · ${productName(a.requested_terms.product_id)}`
                            : productName(a.requested_terms.product_id)}
                        </small>
                      </td>
                      <td data-label="Сумма" className="numeric-cell">
                        <strong>{money(a.requested_terms.amount)}</strong>
                        <small>{a.requested_terms.term_months} мес.</small>
                      </td>
                      <td data-label="Статус">
                        <StatusBadge status={a.status} />
                      </td>
                      {bank && (
                        <td data-label="Риск">
                          <span className={`risk risk-${a.risk?.risk_level}`}>
                            {a.risk?.risk_level || "Нет оценки"}
                          </span>
                        </td>
                      )}
                      {bank && (
                        <td data-label="Ответственный">
                          {a.assigned_officer_id
                            ? identity.user(a.assigned_officer_id)
                                ?.displayName ||
                              (a.assigned_officer_id === "banker"
                                ? "Сотрудник банка"
                                : a.assigned_officer_id === "banker_two"
                                  ? "Второй сотрудник"
                                  : a.assigned_officer_id)
                            : "Не назначен"}
                        </td>
                      )}
                      <td data-label="Обновлена">{date(a.updated_at)}</td>
                      <td>
                        <Link
                          className="open-link"
                          aria-label={`Открыть заявку ${shortId(a.id)}`}
                          to={`${bank ? "/bank" : "/client"}/applications/${a.id}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Заявки не найдены">
              <p>Измените поиск или фильтры</p>
              <Button
                variant="default"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setProduct("");
                  setRisk("");
                  setAssignment(null);
                }}
              >
                Сбросить фильтры
              </Button>
            </Empty>
          )}
          <div className="table-footer">
            Показано {list.length} из {q.data?.length || 0} заявок
            {list.length > 20 && (
              <Pagination
                aria-label="Страницы заявок"
                total={Math.ceil(list.length / 20)}
                value={page}
                onChange={setPage}
              />
            )}
          </div>
        </QueryState>
      </Panel>
    </>
  );
}
