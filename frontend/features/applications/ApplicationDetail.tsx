import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Modal,
  NumberInput,
  Tabs,
  Textarea,
  Select,
} from "@mantine/core";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  History,
  ShieldCheck,
  Building2,
  MessageSquare,
  Check,
  Minus,
} from "lucide-react";
import { useSession } from "../../app/session";
import { demo, productName, products } from "../../shared/api/demo";
import type { Application } from "../../shared/api/types";
import {
  date,
  money,
  purposeName,
  shortId,
  statuses,
} from "../../shared/format";
import {
  PageTitle,
  Panel,
  QueryState,
  Metrics,
  StatusBadge,
  ErrorMessage,
  Empty,
} from "../../components/ui/common";
import { CompanyInfo } from "../company/Company";
import { DocumentList } from "../documents/Documents";
import { Progress } from "./Dashboard";
export function ApplicationDetail({ bank = false }: { bank?: boolean }) {
  const { id } = useParams();
  const { session } = useSession();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["application", id, bank ? "bank" : session?.username],
    queryFn: () => demo.application(id!, bank ? undefined : session!.username),
  });
  const [response, setResponse] = useState("");
  const [action, setAction] = useState<"accept" | "decline" | "submit" | null>(
    null,
  );
  const [bankAction, setBankAction] = useState<
    "offer" | "reject" | "info" | null
  >(null);
  const mutation = useMutation({
    mutationFn: async () =>
      action === "submit"
        ? demo.submit(id!)
        : action
          ? demo.respond(id!, action === "accept")
          : demo.resubmit(id!, response),
    onSuccess: async () => {
      setAction(null);
      setResponse("");
      await qc.invalidateQueries();
    },
  });
  const a = q.data;
  const tab = params.get("tab") || "data";
  return (
    <>
      {!bank && (
        <Link
          className="back-link"
          to={bank ? "/bank/applications" : "/client/applications"}
        >
          <ArrowLeft size={15} /> {bank ? "Очередь заявок" : "Мои заявки"}
        </Link>
      )}
      <QueryState query={q}>
        {a && (
          <>
            <PageTitle
              title={`Заявка №${shortId(a.id)}`}
              subtitle={`${bank ? a.company.legal_name + " · " : ""}${productName(a.requested_terms.product_id)} · Обновлена ${date(a.updated_at)}`}
              action={<StatusBadge status={a.status} />}
            />
            <div className="detail-grid">
              <div className="stack">
                {!bank && (
                  <Panel>
                    <div className="section-title">
                      <h2>
                        {bank ? "Запрошенные условия" : "Параметры заявки"}
                      </h2>
                      {a.status === "DRAFT" && !bank && (
                        <Button
                          variant="default"
                          component={Link}
                          to={`/client/applications/new?draft=${a.id}`}
                        >
                          Редактировать
                        </Button>
                      )}
                    </div>
                    <Metrics
                      items={[
                        ["Сумма", money(a.requested_terms.amount)],
                        ["Срок", `${a.requested_terms.term_months} мес.`],
                        [
                          "Цель",
                          <span className="metric-purpose">
                            {purposeName(a.requested_terms.purpose)}
                          </span>,
                        ],
                      ]}
                    />
                    <hr />
                    <Progress status={a.status} />
                    {a.requested_terms.comment && (
                      <p>Комментарий: {a.requested_terms.comment}</p>
                    )}
                  </Panel>
                )}
                {bank ? (
                  <>
                    <Tabs
                      value={tab}
                      onChange={(v) => setParams({ tab: v || "data" })}
                    >
                      <Tabs.List>
                        <Tabs.Tab
                          value="data"
                          leftSection={<Building2 size={16} />}
                        >
                          Данные
                        </Tabs.Tab>
                        <Tabs.Tab
                          value="risk"
                          leftSection={<ShieldCheck size={16} />}
                        >
                          Проверки и риск
                        </Tabs.Tab>
                        <Tabs.Tab
                          value="documents"
                          leftSection={<FileText size={16} />}
                        >
                          Документы
                        </Tabs.Tab>
                        <Tabs.Tab
                          value="history"
                          leftSection={<History size={16} />}
                        >
                          История
                        </Tabs.Tab>
                      </Tabs.List>
                      <div className="tab-content">
                        {tab === "data" ? (
                          <div className="stack">
                            <Panel>
                              <h3>Запрошенные условия</h3>
                              <Metrics
                                items={[
                                  ["Сумма", money(a.requested_terms.amount)],
                                  [
                                    "Срок",
                                    `${a.requested_terms.term_months} мес.`,
                                  ],
                                  [
                                    "Цель",
                                    <span className="metric-purpose">
                                      {purposeName(a.requested_terms.purpose)}
                                    </span>,
                                  ],
                                ]}
                              />
                              {a.latest_offer && (
                                <p>
                                  Предложено: {money(a.latest_offer.amount)} ·{" "}
                                  {a.latest_offer.term_months} мес. ·{" "}
                                  {a.latest_offer.annual_rate}%
                                </p>
                              )}
                            </Panel>
                            <CompanyInfo company={a.company} />
                          </div>
                        ) : tab === "risk" ? (
                          <RiskPanel application={a} />
                        ) : tab === "documents" ? (
                          <Panel>
                            <DocumentList application={a} bank />
                          </Panel>
                        ) : tab === "history" ? (
                          <Panel>
                            <EventHistory application={a} />
                          </Panel>
                        ) : (
                          <Panel>
                            <p>Вкладка не найдена</p>
                          </Panel>
                        )}
                      </div>
                    </Tabs>
                  </>
                ) : (
                  <>
                    {a.latest_offer && (
                      <OfferPanel application={a} onRespond={setAction} />
                    )}{" "}
                    {a.status === "NEEDS_INFO" && (
                      <Panel>
                        <div className="icon-label">
                          <MessageSquare size={19} className="accent" />
                          <h2>Ответ на запрос банка</h2>
                        </div>
                        {a.information_requests
                          .filter((r) => r.status === "OPEN")
                          .map((r) => (
                            <Alert
                              color="yellow"
                              title={`Запрос от ${date(r.created_at)}`}
                              key={r.id}
                            >
                              {r.message}
                            </Alert>
                          ))}
                        <Textarea
                          label="Ваш ответ банку"
                          placeholder="Укажите уточнения и приложенные документы"
                          value={response}
                          onChange={(e) => setResponse(e.target.value)}
                          minRows={3}
                          maxLength={3000}
                          required
                        />
                        <DocumentList application={a} />
                        <ErrorMessage error={mutation.error} />
                        <Button
                          onClick={() => mutation.mutate()}
                          loading={mutation.isPending}
                          disabled={!response.trim()}
                        >
                          Отправить уточнения
                        </Button>
                      </Panel>
                    )}
                    {a.status !== "NEEDS_INFO" && (
                      <Panel>
                        <DocumentList application={a} />
                      </Panel>
                    )}
                    <Panel>
                      <EventHistory application={a} />
                    </Panel>
                  </>
                )}
              </div>
              <aside className="summary stack">
                <Panel>
                  <h3>{bank ? "Работа с заявкой" : "Что дальше"}</h3>
                  <p className="next-action">{a.next_action}</p>
                  {bank ? (
                    <>
                      <div className="bank-actions">
                        <Button
                          disabled={a.status !== "UNDER_REVIEW"}
                          onClick={() => setBankAction("offer")}
                        >
                          Предложить условия
                        </Button>
                        <Button
                          variant="default"
                          disabled={a.status !== "UNDER_REVIEW"}
                          onClick={() => setBankAction("info")}
                        >
                          Запросить сведения
                        </Button>
                        <Button
                          variant="subtle"
                          disabled={a.status !== "UNDER_REVIEW"}
                          onClick={() => setBankAction("reject")}
                        >
                          Отказать
                        </Button>
                      </div>
                      {a.status !== "UNDER_REVIEW" && (
                        <small className="muted">
                          Решение доступно при статусе «На рассмотрении».
                        </small>
                      )}
                    </>
                  ) : a.status === "DRAFT" ? (
                    <Button fullWidth onClick={() => setAction("submit")}>
                      Отправить заявку
                    </Button>
                  ) : a.status === "COMPLETED" ? (
                    <div className="success-text icon-label">
                      <CheckCircle2 size={18} />
                      Оформление завершено
                    </div>
                  ) : null}
                </Panel>
                {bank && a.risk && tab !== "risk" && (
                  <Panel className="score-overview">
                    <span className="eyebrow">ДЕМО-СКОРИНГ</span>
                    <div className="score-compact">
                      <strong>
                        {a.risk.score}
                        <small> / 100</small>
                      </strong>
                      <span className={`risk risk-${a.risk.risk_level}`}>
                        {a.risk.risk_level}
                      </span>
                    </div>
                    <p>Оценка помогает сотруднику, но не заменяет решение.</p>
                    <Button
                      variant="default"
                      fullWidth
                      onClick={() => setParams({ tab: "risk" })}
                    >
                      Смотреть факторы
                    </Button>
                  </Panel>
                )}
                {bank && tab === "risk" && <VerificationPanel />}
                {!bank && (
                  <Panel>
                    <ShieldCheck size={22} className="muted" />
                    <h3>Автономный прототип</h3>
                    <p>
                      Все операции демонстрационные. Изменения сохраняются
                      только в браузере.
                    </p>
                  </Panel>
                )}
              </aside>
            </div>
            <Modal
              opened={!!action}
              onClose={() => setAction(null)}
              title={
                action === "accept"
                  ? "Принять предложение банка?"
                  : action === "decline"
                    ? "Отклонить предложение?"
                    : "Отправить заявку?"
              }
              centered
            >
              <p>
                {action === "accept"
                  ? "Вы подтверждаете предложенные сумму, срок и ставку. Будет показано демонстрационное завершение оформления."
                  : action === "decline"
                    ? "Предложение будет закрыто. Для другого финансирования можно создать новую заявку."
                    : "После отправки изменить заявку можно только через запрос уточнений."}
              </p>
              <ErrorMessage error={mutation.error} />
              <div className="row end">
                <Button variant="default" onClick={() => setAction(null)}>
                  Отмена
                </Button>
                <Button
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  Подтвердить
                </Button>
              </div>
            </Modal>
            <BankAction
              key={bankAction || "closed"}
              application={a}
              action={bankAction}
              onClose={() => setBankAction(null)}
            />
          </>
        )}
      </QueryState>
    </>
  );
}
function OfferPanel({
  application: a,
  onRespond,
}: {
  application: Application;
  onRespond: (action: "accept" | "decline") => void;
}) {
  const o = a.latest_offer!;
  return (
    <Panel className="offer-panel">
      <div className="section-title">
        <h2>Предложение банка</h2>
        <span className="status status-COMPLETED">Индивидуальные условия</span>
      </div>
      <p>{o.reason}</p>
      <table className="offer-table">
        <thead>
          <tr>
            <th>Условия</th>
            <th>Запрошено</th>
            <th>Предложено банком</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Сумма</td>
            <td>{money(a.requested_terms.amount)}</td>
            <td>{money(o.amount)}</td>
          </tr>
          <tr>
            <td>Срок</td>
            <td>{a.requested_terms.term_months} мес.</td>
            <td>{o.term_months} мес.</td>
          </tr>
          <tr>
            <td>Ставка</td>
            <td>По решению банка</td>
            <td>{o.annual_rate}% годовых</td>
          </tr>
        </tbody>
      </table>
      <Button
        variant="subtle"
        className="explain-offer"
        onClick={() => window.dispatchEvent(new Event("open-credit-assistant"))}
      >
        Объяснить условия через AI-помощника
      </Button>
      {a.status === "OFFERED" && (
        <div className="row">
          <Button
            onClick={() => onRespond("accept")}
            leftSection={<Check size={16} />}
          >
            Принять предложение
          </Button>
          <Button variant="default" onClick={() => onRespond("decline")}>
            Отклонить
          </Button>
        </div>
      )}
    </Panel>
  );
}
export function EventHistory({ application: a }: { application: Application }) {
  return (
    <>
      <h3>История заявки</h3>
      <div className="timeline">
        {[...a.events].reverse().map((e) => (
          <div className="timeline-event" key={e.id}>
            <i />
            <div>
              <strong>{statuses[e.to_status]}</strong>
              <small>
                {date(e.occurred_at)} ·{" "}
                {new Date(e.occurred_at).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
              <p>{e.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
function RiskPanel({ application: a }: { application: Application }) {
  const r = a.risk;
  return r ? (
    <Panel className="risk-panel">
      <h2>Проверки и скоринг</h2>
      <div className="risk-header">
        <div className="score-circle" data-risk={r.risk_level}>
          <strong>{r.score}</strong>
          <span>из 100</span>
        </div>
        <div>
          <span className={`risk risk-${r.risk_level}`}>
            {r.risk_level} ·{" "}
            {r.risk_level === "LOW"
              ? "Низкий риск"
              : r.risk_level === "HIGH"
                ? "Высокий риск"
                : "Средний риск"}
          </span>
          <h3>Демонстрационная оценка</h3>
          <p>{r.recommendation}</p>
        </div>
      </div>
      <span className="muted">Версия правил: {r.rules_version}</span>
      <hr />
      <h3>Факторы оценки</h3>
      {r.factors.map((f) => (
        <div className="factor" key={f.code}>
          <div
            className={
              f.direction === "POSITIVE" ? "success-text" : "warning-text"
            }
          >
            {f.direction === "POSITIVE" ? (
              <CheckCircle2 size={19} />
            ) : (
              <Minus size={19} />
            )}
          </div>
          <div>
            <strong>
              {
                (
                  {
                    MARGIN: "Финансовая устойчивость",
                    DEBT_COVERAGE: "Долговая нагрузка",
                    BUSINESS_AGE: "Возраст бизнеса",
                    CREDIT_HISTORY: "Кредитная история",
                  } as Record<string, string>
                )[f.code]
              }
            </strong>
            <p>{f.explanation}</p>
          </div>
          <b>{f.points} бал.</b>
        </div>
      ))}
    </Panel>
  ) : (
    <Panel>
      <Empty title="Скоринг ещё не рассчитан">
        <p>Оценка появится после отправки заявки</p>
      </Empty>
    </Panel>
  );
}
function VerificationPanel() {
  return (
    <Panel>
      <h3>Автоматические проверки</h3>
      {["Реестр", "БКИ", "Скоринг"].map((s) => (
        <div className="verification" key={s}>
          <strong>{s}</strong>
          <span className="status status-COMPLETED">
            {s === "Скоринг" ? "Рассчитан" : "Пройдена"}
          </span>
        </div>
      ))}
      <p className="muted">Демо-результаты. Проверки смоделированы локально.</p>
    </Panel>
  );
}
function BankAction({
  application: a,
  action,
  onClose,
}: {
  application: Application;
  action: "offer" | "reject" | "info" | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const p = products.find((p) => p.id === a.requested_terms.product_id)!;
  const [amount, setAmount] = useState(a.requested_terms.amount);
  const [term, setTerm] = useState(a.requested_terms.term_months);
  const [rate, setRate] = useState("17.5");
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState(false);
  const valid =
    reason.trim() &&
    (action !== "offer" ||
      (Number(amount) >= Number(p.min_amount) &&
        Number(amount) <= Number(a.requested_terms.amount) &&
        term >= p.min_term &&
        term <= p.max_term &&
        Number(rate) >= 0 &&
        Number(rate) <= 100));
  const mutation = useMutation({
    mutationFn: () =>
      action === "info"
        ? demo.requestInfo(a.id, reason)
        : demo.decision(
            a.id,
            action === "offer" ? "OFFERED" : "REJECTED",
            reason,
            action === "offer"
              ? { amount, term_months: term, annual_rate: rate }
              : undefined,
          ),
    onSuccess: async () => {
      await qc.invalidateQueries();
      onClose();
    },
  });
  return (
    <Modal
      opened={!!action}
      onClose={onClose}
      title={
        action === "offer"
          ? "Предложить условия"
          : action === "reject"
            ? "Отказ по заявке"
            : "Запросить дополнительные сведения"
      }
      size="lg"
      centered
    >
      <p className="muted">
        Заявка №{shortId(a.id)} · {a.company.legal_name}
      </p>
      {stage ? (
        <>
          <Alert
            color={action === "reject" ? "red" : "yellow"}
            title="Подтвердите действие"
          >
            <p>
              {action === "offer"
                ? `Предложение: ${money(amount)}, ${term} мес., ${rate}% годовых.`
                : action === "reject"
                  ? "Заявка будет отклонена."
                  : "Клиент получит запрос сведений."}
            </p>
            <p>{reason}</p>
          </Alert>
          <ErrorMessage error={mutation.error} />
          <div className="row end">
            <Button
              variant="default"
              onClick={() => setStage(false)}
              disabled={mutation.isPending}
            >
              Назад
            </Button>
            <Button
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Подтвердить решение
            </Button>
          </div>
        </>
      ) : (
        <>
          {action === "offer" && (
            <div className="form-grid">
              <NumberInput
                label="Предлагаемая сумма, ₽"
                value={amount}
                min={Number(p.min_amount)}
                max={Number(a.requested_terms.amount)}
                onChange={(v) => setAmount(String(v))}
                thousandSeparator=" "
                decimalScale={2}
                required
              />
              <NumberInput
                label="Срок, месяцев"
                value={term}
                min={p.min_term}
                max={p.max_term}
                onChange={(v) => setTerm(Number(v))}
                allowDecimal={false}
                required
              />
              <NumberInput
                label="Годовая ставка, %"
                value={rate}
                min={0}
                max={100}
                decimalScale={2}
                onChange={(v) => setRate(String(v))}
                required
              />
            </div>
          )}
          {action === "info" && (
            <Select
              label="Шаблон запроса"
              placeholder="Выберите или напишите свой"
              onChange={(v) => v && setReason(v)}
              data={[
                "Приложите выписку по расчётному счёту за последние 6 месяцев.",
                "Уточните среднемесячную выручку и действующие долговые обязательства.",
              ]}
            />
          )}
          <Textarea
            label={
              action === "info"
                ? "Какие сведения нужны"
                : action === "reject"
                  ? "Причина отказа"
                  : "Комментарий к предложению"
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minRows={4}
            maxLength={3000}
            required
          />
          <p className="muted">
            Действие и причина будут сохранены в истории заявки.
          </p>
          <div className="row end">
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button disabled={!valid} onClick={() => setStage(true)}>
              Проверить и подтвердить
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
