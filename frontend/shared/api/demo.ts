import type {
  Application,
  Company,
  Document,
  Draft,
  News,
  Product,
  Risk,
  Status,
} from "./types";
import { statuses } from "../format";
export const products: Product[] = [
  {
    id: "working",
    code: "WORKING_CAPITAL",
    name: "Оборотный кредит",
    purpose: "WORKING_CAPITAL",
    description: "Закупки и текущие расходы",
    min_amount: "50000",
    max_amount: "5000000",
    min_term: 3,
    max_term: 36,
    annual_rate: "18",
  },
  {
    id: "investment",
    code: "INVESTMENT",
    name: "Инвестиционный кредит",
    purpose: "INVESTMENT",
    description: "Оборудование и развитие бизнеса",
    min_amount: "300000",
    max_amount: "15000000",
    min_term: 12,
    max_term: 60,
    annual_rate: "16.5",
  },
];
export const companies: Record<string, Company> = {
  client_good: {
    id: "vector",
    inn: "7701234567",
    legal_name: "ООО «Вектор»",
    form: "ООО",
    industry: "TRADE",
    months_active: 48,
    revenue: "2400000",
    expenses: "1450000",
    debt_payment: "120000",
  },
  client_risky: {
    id: "service",
    inn: "7701234599",
    legal_name: "ИП Сервис",
    form: "ИП",
    industry: "SERVICES",
    months_active: 8,
    revenue: "450000",
    expenses: "390000",
    debt_payment: "85000",
  },
};
const key = "smart-credit-demo-v1";
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
export const nextAction = (s: Status) =>
  ({
    DRAFT: "Заполните заявку и отправьте её на рассмотрение",
    SUBMITTED: "Ожидайте начала проверки",
    VERIFYING: "Ожидайте результатов проверки",
    NEEDS_INFO: "Предоставьте дополнительные сведения и отправьте повторно",
    UNDER_REVIEW: "Ожидайте решения банка",
    OFFERED: "Ознакомьтесь с предложением банка",
    REJECTED: "Банк отказал в выдаче кредита. Причина указана в истории",
    ACCEPTED: "Предложение принято",
    DECLINED: "Вы отклонили предложение банка",
    COMPLETED: "Демонстрационное оформление завершено",
  })[s];
export function score(company: Company): Risk {
  const healthy =
    Number(company.revenue) -
      Number(company.expenses) -
      Number(company.debt_payment) >
    100000;
  return {
    score: healthy ? 87 : 32,
    risk_level: healthy ? "LOW" : "HIGH",
    recommendation: healthy
      ? "Устойчивые показатели бизнеса. Рекомендуется рассмотреть запрошенные условия."
      : "Повышенная долговая нагрузка. Рекомендуется уточнить финансовые показатели.",
    rules_version: "demo-rules-v1",
    factors: [
      {
        code: "MARGIN",
        direction: healthy ? "POSITIVE" : "NEGATIVE",
        points: healthy ? 30 : 10,
        explanation: healthy
          ? "Стабильная операционная маржа и положительный денежный поток"
          : "Низкий свободный денежный поток",
      },
      {
        code: "DEBT_COVERAGE",
        direction: healthy ? "POSITIVE" : "NEGATIVE",
        points: healthy ? 27 : 7,
        explanation: healthy
          ? "Достаточное покрытие кредитного платежа"
          : "Высокая долговая нагрузка",
      },
      {
        code: "BUSINESS_AGE",
        direction: company.months_active >= 36 ? "POSITIVE" : "NEGATIVE",
        points: company.months_active >= 36 ? 15 : 5,
        explanation: `Возраст бизнеса — ${company.months_active} месяцев`,
      },
      {
        code: "CREDIT_HISTORY",
        direction: "POSITIVE",
        points: healthy ? 15 : 10,
        explanation: "Синтетическая кредитная история проверена",
      },
    ],
  };
}
function seed(): Application[] {
  const make = (
    id: string,
    owner: string,
    status: Status,
    amount: string,
    product_id = "working",
  ): Application => ({
    id,
    owner,
    status,
    requested_terms: {
      product_id,
      amount,
      term_months: 24,
      purpose: product_id === "working" ? "WORKING_CAPITAL" : "EQUIPMENT",
    },
    company: { ...companies[owner] },
    updated_at: "2026-10-22T10:20:00Z",
    next_action: nextAction(status),
    latest_offer: null,
    documents: [],
    information_requests: [],
    risk: status === "DRAFT" ? null : score(companies[owner]),
    events: [
      {
        id: uid(),
        to_status: "DRAFT",
        reason: "Создана заявка",
        occurred_at: "2026-10-21T09:00:00Z",
      },
      {
        id: uid(),
        to_status: status,
        reason:
          status === "REJECTED"
            ? "Недостаточно свободного денежного потока для обслуживания кредита"
            : "Автоматические проверки завершены",
        occurred_at: "2026-10-22T10:20:00Z",
      },
    ],
  });
  const list = [
    make("SC-1042", "client_good", "UNDER_REVIEW", "3200000"),
    make("SC-1038", "client_good", "OFFERED", "1800000", "investment"),
    make("SC-1035", "client_good", "NEEDS_INFO", "850000"),
    make("SC-1024", "client_good", "COMPLETED", "600000"),
    make("SC-1019", "client_good", "DRAFT", "450000"),
    make("SC-1041", "client_risky", "UNDER_REVIEW", "700000"),
    make("SC-1029", "client_risky", "REJECTED", "1200000"),
  ];
  list[1].latest_offer = {
    amount: "1500000",
    term_months: 24,
    annual_rate: "17.5",
    reason: "Предлагаем уменьшенную сумму с учётом текущей долговой нагрузки.",
    created_at: "2026-10-22T11:00:00Z",
  };
  list[2].information_requests = [
    {
      id: uid(),
      message:
        "Приложите выписку по расчётному счёту за последние 6 месяцев и уточните текущие долговые платежи.",
      status: "OPEN",
      created_at: "2026-10-22T10:20:00Z",
    },
  ];
  list[0].documents = [
    {
      id: uid(),
      file_name: "Бухгалтерская_отчётность.pdf",
      size_bytes: 245760,
      created_at: "2026-10-22T10:00:00Z",
    },
  ];
  return list;
}
export function readApplications(): Application[] {
  const raw = localStorage.getItem(key);
  if (!raw) {
    const data = seed();
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      "Не удалось прочитать демоданные. Сбросьте их в настройках.",
    );
  }
}
function store(list: Application[]) {
  localStorage.setItem(key, JSON.stringify(list));
}
function change(id: string, fn: (a: Application) => void): Application {
  const list = readApplications();
  const a = list.find((x) => x.id === id);
  if (!a) throw new Error("Заявка не найдена");
  fn(a);
  a.updated_at = now();
  a.next_action = nextAction(a.status);
  store(list);
  return a;
}
function transition(a: Application, status: Status, reason: string) {
  a.status = status;
  a.events.push({ id: uid(), to_status: status, reason, occurred_at: now() });
}
const delay = async <T>(value: T): Promise<T> => {
  await new Promise((r) => setTimeout(r, 160));
  return structuredClone(value);
};
export const demo = {
  applications: (owner?: string) =>
    delay(readApplications().filter((a) => !owner || a.owner === owner)),
  application: (id: string, owner?: string) => {
    const a = readApplications().find(
      (x) => x.id === id && (!owner || x.owner === owner),
    );
    return a ? delay(a) : Promise.reject(new Error("Заявка не найдена"));
  },
  company: (owner: string) => delay(companies[owner] || companies.client_good),
  products: () => delay(products),
  news: (owner: string) =>
    delay(
      news.filter(
        (n) =>
          n.industry === "ALL" || n.industry === companies[owner]?.industry,
      ),
    ),
  saveDraft: async (owner: string, draft: Draft, id?: string) => {
    const p = products.find((p) => p.id === draft.product_id);
    if (
      !p ||
      Number(draft.amount) < Number(p.min_amount) ||
      Number(draft.amount) > Number(p.max_amount) ||
      draft.term_months < p.min_term ||
      draft.term_months > p.max_term
    )
      throw new Error("Сумма или срок выходят за пределы продукта");
    if (id)
      return delay(
        change(id, (a) => {
          if (a.owner !== owner || a.status !== "DRAFT")
            throw new Error("Редактирование недоступно");
          a.requested_terms = { ...draft };
          a.company = { ...a.company, ...draft.company_financials };
        }),
      );
    const list = readApplications();
    const idNew = `SC-${Math.max(1042, ...list.map((a) => Number(a.id.slice(3)) || 0)) + 1}`;
    const a: Application = {
      id: idNew,
      owner,
      status: "DRAFT",
      requested_terms: { ...draft },
      company: { ...companies[owner], ...draft.company_financials },
      updated_at: now(),
      next_action: nextAction("DRAFT"),
      latest_offer: null,
      documents: [],
      information_requests: [],
      risk: null,
      events: [
        {
          id: uid(),
          to_status: "DRAFT",
          reason: "Создан черновик",
          occurred_at: now(),
        },
      ],
    };
    store([a, ...list]);
    return delay(a);
  },
  submit: async (id: string) =>
    delay(
      change(id, (a) => {
        if (a.status !== "DRAFT")
          throw new Error("Отправить можно только черновик");
        transition(a, "SUBMITTED", "Клиент отправил заявку");
        transition(
          a,
          "VERIFYING",
          "Начаты демонстрационные проверки реестра и БКИ",
        );
        a.risk = score(a.company);
        transition(
          a,
          "UNDER_REVIEW",
          "Проверки завершены. Заявка передана сотруднику банка",
        );
      }),
    ),
  requestInfo: async (id: string, message: string) =>
    delay(
      change(id, (a) => {
        if (a.status !== "UNDER_REVIEW") throw new Error("Действие недоступно");
        if (!message.trim()) throw new Error("Укажите запрашиваемые сведения");
        a.information_requests.push({
          id: uid(),
          message,
          status: "OPEN",
          created_at: now(),
        });
        transition(a, "NEEDS_INFO", message);
      }),
    ),
  resubmit: async (id: string, message: string) =>
    delay(
      change(id, (a) => {
        if (a.status !== "NEEDS_INFO") throw new Error("Действие недоступно");
        if (!message.trim()) throw new Error("Добавьте ответ банку");
        a.information_requests.forEach((r) => (r.status = "RESOLVED"));
        transition(a, "SUBMITTED", `Ответ клиента: ${message}`);
        transition(a, "VERIFYING", "Повторные демонстрационные проверки");
        a.risk = score(a.company);
        transition(a, "UNDER_REVIEW", "Повторные проверки завершены");
      }),
    ),
  decision: async (
    id: string,
    type: "OFFERED" | "REJECTED",
    reason: string,
    offer?: { amount: string; term_months: number; annual_rate: string },
  ) =>
    delay(
      change(id, (a) => {
        if (a.status !== "UNDER_REVIEW")
          throw new Error("Решение уже принято или требуется уточнение");
        if (!reason.trim()) throw new Error("Укажите причину решения");
        if (type === "OFFERED") {
          if (
            !offer ||
            Number(offer.amount) <= 0 ||
            Number(offer.amount) > Number(a.requested_terms.amount)
          )
            throw new Error("Проверьте сумму предложения");
          a.latest_offer = { ...offer, reason, created_at: now() };
        }
        transition(a, type, reason);
      }),
    ),
  respond: async (id: string, accept: boolean) =>
    delay(
      change(id, (a) => {
        if (a.status !== "OFFERED")
          throw new Error("Нет доступного предложения");
        transition(
          a,
          accept ? "ACCEPTED" : "DECLINED",
          accept ? "Клиент принял предложение" : "Клиент отклонил предложение",
        );
        if (accept)
          transition(a, "COMPLETED", "Демонстрационное оформление завершено");
      }),
    ),
  upload: async (id: string, file: File) => {
    if (
      file.size > 5 * 1024 * 1024 ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      !(await file.slice(0, 5).text()).startsWith("%PDF-")
    )
      throw new Error("Выберите PDF до 5 МБ");
    return delay(
      change(id, (a) => {
        if (!["DRAFT", "NEEDS_INFO"].includes(a.status))
          throw new Error("Загрузка доступна в черновике или при уточнении");
        a.documents.push({
          id: uid(),
          file_name: file.name,
          size_bytes: file.size,
          created_at: now(),
        });
        a.events.push({
          id: uid(),
          to_status: a.status,
          reason: `Добавлен документ: ${file.name}`,
          occurred_at: now(),
        });
      }),
    );
  },
  reset: () => {
    localStorage.removeItem(key);
    return delay(readApplications());
  },
};
export const news: News[] = [
  {
    id: "n1",
    title: "Как подготовить бизнес к сезонному росту спроса",
    body: "Проверьте остатки на складе, сроки поставок и резерв денежных средств. Составьте план закупок на ближайший квартал и сравните потребность с текущим оборотным капиталом.\n\nОборотный кредит в демонстрационном каталоге предназначен для закупок и текущих расходов. Выбирайте сумму, соответствующую финансовым возможностям компании.",
    category: "Оборотный капитал",
    industry: "TRADE",
    date: "2026-10-22",
  },
  {
    id: "n2",
    title: "Финансовая подушка: сколько нужно вашему бизнесу",
    body: "Начните с обязательных ежемесячных расходов: аренды, оплаты труда, налогов и кредитных платежей. Резерв помогает компании продолжать работу при задержке поступлений.\n\nСравните несколько сценариев выручки и учитывайте сезонность. Этот материал создан для демонстрации интерфейса.",
    category: "Финансы",
    industry: "ALL",
    date: "2026-10-21",
  },
  {
    id: "n3",
    title: "Оборудование в кредит: что учесть перед покупкой",
    body: "Оцените, какую дополнительную выручку принесёт оборудование, и сопоставьте её с затратами на обслуживание и ежемесячным платежом.\n\nИнвестиционный кредит подходит для долгосрочного развития. Все параметры продуктов в этом прототипе синтетические.",
    category: "Развитие",
    industry: "ALL",
    date: "2026-10-20",
  },
  {
    id: "n4",
    title: "Планирование загрузки для сервисного бизнеса",
    body: "Отслеживайте загрузку команды, средний чек и повторные обращения. Эти показатели помогают планировать доходы и расходы сервисной компании.\n\nМатериал является синтетическим примером персональной новостной ленты.",
    category: "Сфера услуг",
    industry: "SERVICES",
    date: "2026-10-22",
  },
];
export const productName = (id: string) =>
  products.find((p) => p.id === id)?.name || "Кредит для бизнеса";
