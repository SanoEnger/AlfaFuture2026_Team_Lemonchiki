import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Alert,
  Button,
  Checkbox,
  NumberInput,
  Select,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Save,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { useSession } from "../../app/session";
import { products, productName } from "../../shared/api/demo";
import { data as demo } from "../../shared/api/data";
import type { Application, Company, Draft } from "../../shared/api/types";
import { money, purposeName } from "../../shared/format";
import {
  PageTitle,
  Panel,
  QueryState,
  ErrorMessage,
} from "../../components/ui/common";
import { CompanyInfo } from "../company/Company";
import { validateDraft } from "../../shared/validation";
import { isServerMode } from "../../shared/api/data";
const steps = ["Выбор продукта", "Параметры", "Компания", "Подтверждение"];
export function Wizard() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const [resumedId] = useState(() =>
    isServerMode()
      ? sessionStorage.getItem(`smart-credit-api-draft-${session!.username}`)
      : null,
  );
  const id = params.get("draft") || resumedId;
  const q = useQuery({
    queryKey: ["wizard", session?.username, id],
    queryFn: async () => ({
      company: await demo.company(session!.username),
      existing: id ? await demo.application(id, session!.username) : null,
    }),
  });
  return (
    <QueryState query={q}>
      {q.data && (
        <WizardForm
          key={id || "new"}
          company={q.data.company}
          existing={q.data.existing}
          preferred={params.get("product") || undefined}
        />
      )}
    </QueryState>
  );
}
function WizardForm({
  company,
  existing,
  preferred,
}: {
  company: Company;
  existing: Application | null;
  preferred?: string;
}) {
  const { session } = useSession();
  const wideSummary = useMediaQuery("(min-width: 769px)");
  const [, setContextParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const storageKey = `smart-credit-form-${session!.username}-${existing?.id || "new"}`;
  const [draft, setDraft] = useState<Draft>(() => {
    if (existing)
      return {
        ...existing.requested_terms,
        company_financials: {
          revenue: existing.company.revenue,
          expenses: existing.company.expenses,
          debt_payment: existing.company.debt_payment,
          months_active: existing.company.months_active,
        },
      };
    try {
      if (isServerMode()) throw new Error("Use server draft");
      const cached = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (cached) return cached.draft || cached;
    } catch {}
    const p = products.find((p) => p.id === preferred) || products[0];
    return {
      product_id: p.id,
      amount: "3200000",
      term_months: 24,
      purpose: p.purpose,
      comment: "",
      company_financials: {
        revenue: company.revenue,
        expenses: company.expenses,
        debt_payment: company.debt_payment,
        months_active: company.months_active,
      },
    };
  });
  const [step, setStep] = useState(0);
  useEffect(() => {
    setContextParams(
      (current) => {
        if (current.get("product") === draft.product_id) return current;
        const next = new URLSearchParams(current);
        next.set("product", draft.product_id);
        return next;
      },
      { replace: true },
    );
  }, [draft.product_id]);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("Ожидает сохранения");
  const [saveFailed, setSaveFailed] = useState(false);
  const [consent, setConsent] = useState(false);
  const idRef = useRef<string | undefined>(
    existing?.id ||
      (() => {
        try {
          if (isServerMode()) return undefined;
          return JSON.parse(localStorage.getItem(storageKey) || "null")?.id;
        } catch {
          return undefined;
        }
      })(),
  );
  const submitting = useRef(false);
  const versionRef = useRef<number | undefined>(
    existing?.version ||
      (() => {
        try {
          if (isServerMode()) return undefined;
          return JSON.parse(localStorage.getItem(storageKey) || "null")
            ?.version;
        } catch {
          return undefined;
        }
      })(),
  );
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(draft);
  latest.current = draft;
  const product =
    products.find((p) => p.id === draft.product_id) || products[0];
  const fieldErrors = validateDraft(draft, product);
  const valid = Object.keys(fieldErrors).length === 0;
  function save() {
    const snapshot = structuredClone(latest.current);
    setSaved("Сохраняем…");
    setSaveFailed(false);
    const task = pending.current
      .catch(() => {})
      .then(async () => {
        const a = await demo.saveDraft(
          session!.username,
          snapshot,
          idRef.current,
          versionRef.current,
        );
        idRef.current = a.id;
        versionRef.current = a.version;
        if (isServerMode())
          sessionStorage.setItem(
            `smart-credit-api-draft-${session!.username}`,
            a.id,
          );
        else
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              id: a.id,
              version: a.version,
              draft: latest.current,
            }),
          );
        if (JSON.stringify(snapshot) === JSON.stringify(latest.current)) {
          setSaved(
            `Сохранено в ${new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`,
          );
          setError(null);
        }
        await qc.invalidateQueries({ queryKey: ["applications"] });
        return a;
      })
      .catch((e) => {
        setSaved("Не удалось сохранить");
        setSaveFailed(true);
        setError(e as Error);
        throw e;
      });
    pending.current = task;
    return task;
  }
  useEffect(() => {
    try {
      if (!isServerMode())
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            id: idRef.current,
            version: versionRef.current,
            draft,
          }),
        );
      setSaved("Ожидает сохранения");
    } catch {
      setError(new Error("Не удалось сохранить данные в браузере"));
      setSaved("Не удалось сохранить");
      setSaveFailed(true);
    }
    if (
      !valid ||
      submitting.current ||
      (existing && existing.status !== "DRAFT")
    )
      return;
    const timer = setTimeout(() => {
      if (submitting.current) return;
      save().catch((e) => setError(e));
    }, 700);
    return () => clearTimeout(timer);
  }, [draft]);
  if (existing && existing.status !== "DRAFT")
    return (
      <Alert color="yellow">
        Эта заявка уже отправлена.{" "}
        <Link to={`/client/applications/${existing.id}`}>Открыть карточку</Link>
      </Alert>
    );
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }
  function financial(
    key: keyof Draft["company_financials"],
    value: string | number,
  ) {
    setDraft((d) => ({
      ...d,
      company_financials: {
        ...d.company_financials,
        [key]: key === "months_active" ? Number(value) : String(value),
      },
    }));
  }
  async function proceed(submit = false) {
    if (submitting.current) return;
    if (step > 0 && !valid) {
      setError(new Error("Проверьте сумму, срок и финансовые показатели"));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      if (step === 0) {
        setStep(1);
      } else {
        const a = await save();
        if (submit) {
          await demo.submit(a.id);
          localStorage.removeItem(storageKey);
          if (isServerMode())
            sessionStorage.removeItem(
              `smart-credit-api-draft-${session!.username}`,
            );
          await qc.invalidateQueries();
          navigate(`/client/applications/${a.id}`);
        } else setStep((s) => Math.min(3, s + 1));
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Новая заявка"
        subtitle="Несколько шагов к финансированию вашего бизнеса"
        action={
          <Button variant="default" component={Link} to="/client/applications">
            К списку заявок
          </Button>
        }
      />
      <ol className="wizard-steps">
        {steps.map((s, i) => (
          <li
            key={s}
            className={i === step ? "active" : i < step ? "complete" : ""}
          >
            <span>{i < step ? <Check size={16} /> : i + 1}</span>
            <b>{s}</b>
          </li>
        ))}
      </ol>
      <div className="wizard-grid">
        <div className="stack">
          <Panel>
            <div className="section-title">
              <h2>
                {step + 1}. {steps[step]}
              </h2>
              <span className="muted">Шаг {step + 1} из 4</span>
            </div>
            {step === 0 ? (
              <>
                <p>Выберите программу под задачи вашего бизнеса</p>
                <div className="product-choice">
                  {products.map((p) => (
                    <button
                      className={draft.product_id === p.id ? "selected" : ""}
                      key={p.id}
                      onClick={() => {
                        update("product_id", p.id);
                        update("purpose", p.purpose);
                        if (
                          Number(draft.amount) < Number(p.min_amount) ||
                          Number(draft.amount) > Number(p.max_amount)
                        )
                          update("amount", p.min_amount);
                        if (
                          draft.term_months < p.min_term ||
                          draft.term_months > p.max_term
                        )
                          update("term_months", p.min_term);
                      }}
                    >
                      <span className="row between">
                        <strong>{p.name}</strong>
                        <span className="radio-dot" />
                      </span>
                      <p>{p.description}</p>
                      <div className="choice-terms">
                        <span>до {money(p.max_amount)}</span>
                        <span>до {p.max_term} мес.</span>
                        <span>от {p.annual_rate}%</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="notice">
                  Синтетические продукты для демонстрации. Условия не являются
                  предложением банка.
                </div>
              </>
            ) : step === 1 ? (
              <div className="form-grid">
                <NumberInput
                  label="Сумма кредита, ₽"
                  description={`От ${money(product.min_amount)} до ${money(product.max_amount)}`}
                  value={draft.amount}
                  onChange={(v) => update("amount", String(v))}
                  min={0}
                  max={Number(product.max_amount)}
                  decimalScale={2}
                  thousandSeparator=" "
                  error={
                    Number(draft.amount) < Number(product.min_amount) ||
                    Number(draft.amount) > Number(product.max_amount)
                      ? "Сумма вне диапазона продукта"
                      : undefined
                  }
                  required
                />
                <NumberInput
                  label="Срок, месяцев"
                  description={`От ${product.min_term} до ${product.max_term} месяцев`}
                  value={draft.term_months}
                  onChange={(v) => update("term_months", Number(v))}
                  allowDecimal={false}
                  min={1}
                  max={product.max_term}
                  error={
                    draft.term_months < product.min_term
                      ? "Проверьте срок"
                      : undefined
                  }
                  required
                />
                <Select
                  label="Цель кредита"
                  value={draft.purpose}
                  onChange={(v) => update("purpose", v || product.purpose)}
                  data={[
                    {
                      value: "WORKING_CAPITAL",
                      label: "Пополнение оборотных средств",
                    },
                    { value: "EQUIPMENT", label: "Покупка оборудования" },
                    { value: "INVESTMENT", label: "Развитие бизнеса" },
                  ]}
                  required
                />
                <Textarea
                  label="Комментарий"
                  disabled={isServerMode()}
                  description={
                    isServerMode()
                      ? "Комментарий не поддерживается текущим серверным контрактом"
                      : "Необязательно"
                  }
                  placeholder="Расскажите о планах бизнеса"
                  value={draft.comment}
                  onChange={(e) => update("comment", e.target.value)}
                  maxLength={3000}
                  minRows={3}
                />
              </div>
            ) : step === 2 ? (
              <>
                <div className="form-grid">
                  <TextInput
                    label="Наименование компании"
                    value={company.legal_name}
                    readOnly
                  />
                  <TextInput label="ИНН" value={company.inn} readOnly />
                  <NumberInput
                    label="Среднемесячная выручка, ₽"
                    error={
                      draft.company_financials.revenue === ""
                        ? "Укажите выручку"
                        : undefined
                    }
                    value={draft.company_financials.revenue}
                    min={0}
                    decimalScale={2}
                    thousandSeparator=" "
                    onChange={(v) => financial("revenue", v)}
                    required
                  />
                  <NumberInput
                    label="Среднемесячные расходы, ₽"
                    error={
                      draft.company_financials.expenses === ""
                        ? "Укажите расходы"
                        : undefined
                    }
                    value={draft.company_financials.expenses}
                    min={0}
                    decimalScale={2}
                    thousandSeparator=" "
                    onChange={(v) => financial("expenses", v)}
                    required
                  />
                  <NumberInput
                    label="Платежи по долгам в месяц, ₽"
                    error={
                      draft.company_financials.debt_payment === ""
                        ? "Укажите платежи, включая нулевые"
                        : undefined
                    }
                    value={draft.company_financials.debt_payment}
                    min={0}
                    decimalScale={2}
                    thousandSeparator=" "
                    onChange={(v) => financial("debt_payment", v)}
                    required
                  />
                  <NumberInput
                    label="Возраст бизнеса, месяцев"
                    value={draft.company_financials.months_active}
                    min={0}
                    max={1200}
                    allowDecimal={false}
                    onChange={(v) => financial("months_active", v)}
                    required
                  />
                </div>
                <div className="notice icon-label">
                  <ShieldCheck size={19} /> При отправке фиксируется копия
                  указанных данных.
                </div>
              </>
            ) : (
              <>
                <dl className="details-list">
                  <div>
                    <dt>Продукт</dt>
                    <dd>{productName(draft.product_id)}</dd>
                  </div>
                  <div>
                    <dt>Сумма</dt>
                    <dd>{money(draft.amount)}</dd>
                  </div>
                  <div>
                    <dt>Срок</dt>
                    <dd>{draft.term_months} мес.</dd>
                  </div>
                  <div>
                    <dt>Цель</dt>
                    <dd>{purposeName(draft.purpose)}</dd>
                  </div>
                  {draft.comment && (
                    <div>
                      <dt>Комментарий</dt>
                      <dd>{draft.comment}</dd>
                    </div>
                  )}
                </dl>
                <hr />
                <Checkbox
                  label="Подтверждаю корректность демонстрационных данных и отправку заявки на рассмотрение"
                  checked={consent}
                  onChange={(e) => setConsent(e.currentTarget.checked)}
                />
                <div className="notice">
                  После отправки обычное редактирование закрывается. Уточнения
                  доступны по запросу банка.
                </div>
              </>
            )}
            <ErrorMessage error={error} />
            <div className="wizard-actions">
              <Button
                variant="default"
                leftSection={<ArrowLeft size={15} />}
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0 || busy}
              >
                Назад
              </Button>
              <span className="save-state" role="status">
                <CheckCircle2 size={14} />
                {saved}
              </span>
              {saveFailed && (
                <Button
                  variant="subtle"
                  disabled={busy}
                  onClick={() => save().catch(() => {})}
                >
                  Повторить сохранение
                </Button>
              )}
              <Button
                rightSection={
                  step === 3 ? <Check size={16} /> : <ArrowRight size={16} />
                }
                onClick={() => proceed(step === 3)}
                loading={busy}
                disabled={step === 3 && !consent}
              >
                {step === 3 ? "Отправить заявку" : "Продолжить"}
              </Button>
            </div>
          </Panel>
          {step === 3 && (
            <CompanyInfo
              company={{ ...company, ...draft.company_financials }}
            />
          )}
        </div>
        <aside className="summary">
          <details className="wizard-summary" open={wideSummary}>
            <summary className="wizard-summary-toggle">
              Сводка заявки · {money(draft.amount)}
              <ChevronDown size={16} />
            </summary>
            <Panel>
              <span className="eyebrow">ВАША ЗАЯВКА</span>
              <h3>{product.name}</h3>
              <dl className="details-list">
                <div>
                  <dt>Сумма</dt>
                  <dd>{money(draft.amount)}</dd>
                </div>
                <div>
                  <dt>Срок</dt>
                  <dd>{draft.term_months} мес.</dd>
                </div>
                <div>
                  <dt>Демо-ставка</dt>
                  <dd>от {product.annual_rate}%</dd>
                </div>
              </dl>
              <hr />
              <p>
                Окончательные условия появятся в предложении сотрудника банка.
              </p>
              <Button
                variant="default"
                fullWidth
                leftSection={<Save size={15} />}
                loading={busy}
                disabled={!valid}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await save();
                  } catch (e) {
                    setError(e as Error);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Сохранить черновик
              </Button>
            </Panel>
          </details>
        </aside>
      </div>
    </>
  );
}
