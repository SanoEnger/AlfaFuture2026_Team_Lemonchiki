import type { Application, Product } from "../../../shared/api/types";
import { productName } from "../../../shared/api/demo";
import { data as demo } from "../../../shared/api/data";
import { date, money, shortId, statuses } from "../../../shared/format";
import type {
  AssistantContext,
  AssistantReply,
  AssistantService,
} from "./types";

export function quickQuestions(context: AssistantContext): string[] {
  if (context.type === "offer")
    return [
      "Сравнить условия",
      "Почему сумма меньше?",
      "Что будет после принятия?",
    ];
  if (context.type === "application")
    return ["Что со статусом?", "Какие документы?", "Что дальше?"];
  if (context.type === "documents")
    return [
      "Что нужно загрузить?",
      "Зачем нужна выписка?",
      "Что после отправки?",
    ];
  return [
    "Как выбрать кредит?",
    "Чем отличаются программы?",
    "Как выбрать срок?",
  ];
}
function applicationOf(context: AssistantContext) {
  return "application" in context ? context.application : null;
}
function reply(
  text: string,
  sources: AssistantReply["sources"],
  actions: AssistantReply["actions"],
): AssistantReply {
  return { text, sources, actions };
}
const catalog = { label: "Каталог демопродуктов", to: "/client/products" };
export function buildReply(
  context: AssistantContext,
  question: string,
  products: Product[],
): AssistantReply {
  const q = question.toLocaleLowerCase("ru-RU");
  const a = applicationOf(context);
  const base = a ? `/client/applications/${encodeURIComponent(a.id)}` : null;
  const source = a
    ? {
        label: `История заявки №${shortId(a.id)} · демоданные`,
        to: `${base}#history`,
      }
    : catalog;
  const history = base
    ? { label: "Открыть историю", to: `${base}#history` }
    : null;
  const documents = {
    label: "Документы",
    to: a
      ? `/client/documents?application=${encodeURIComponent(a.id)}`
      : "/client/documents",
  };
  const statusAnswer = () => {
    if (!a)
      return reply(
        "На этой странице не выбрана заявка. Откройте нужную заявку, чтобы увидеть её актуальный статус и следующий шаг.",
        [catalog],
        [{ label: "Мои заявки", to: "/client/applications" }],
      );
    const event = [...a.events].reverse().find((e) => e.to_status === a.status);
    const details =
      a.status === "REJECTED"
        ? `Зафиксированная причина: ${event?.reason || "Причина не указана в доступных данных."}`
        : a.status === "UNDER_REVIEW"
          ? "Заявка находится у сотрудника банка. Срок решения и причина ожидания в доступных данных не указаны."
          : a.status === "NEEDS_INFO"
            ? a.information_requests
                .filter((r) => r.status === "OPEN")
                .map((r) => r.message)
                .join("\n\n") || "Проверьте запрос банка в карточке заявки."
            : a.status === "COMPLETED"
              ? "Демонстрационное оформление завершено. Реальные средства не перечислялись."
              : "";
    return reply(
      `Заявка №${shortId(a.id)} · ${statuses[a.status]}.\n\n${details}${details ? "\n\n" : ""}Следующий шаг: ${a.next_action}.${event ? `\n\nПоследнее событие этого статуса: ${date(event.occurred_at)}. ${event.reason}` : ""}`,
      [source],
      [history!, documents],
    );
  };
  if (
    /сравн|отлич|сумм.*меньше|почему.*сумм|предложен|оффер|приняти|принять/.test(
      q,
    ) &&
    a?.latest_offer
  ) {
    const offer = a.latest_offer;
    const reason = offer.reason.trim()
      ? `Комментарий банка: ${offer.reason}`
      : "Причина изменения условий не указана. В доступных данных нет оснований объяснять её иначе.";
    const outcome =
      a.status === "OFFERED"
        ? "После вашего явного подтверждения принятия приложение покажет завершение демонстрационного оформления. Сам помощник ничего не принимает и не отправляет."
        : `Текущий статус: ${statuses[a.status]}. Предложение можно принять только при статусе «Предложение банка».`;
    return reply(
      `Запрошенные сумма и срок сохраняются отдельно.\n\nЗапрошено: ${money(a.requested_terms.amount)} · ${a.requested_terms.term_months} мес.\nПредложено: ${money(offer.amount)} · ${offer.term_months} мес. · ${offer.annual_rate}% годовых.\n\n${reason}\n\n${outcome}`,
      [
        {
          label: `Предложение банка по заявке №${shortId(a.id)} · демоданные`,
          to: `${base}#offer`,
        },
      ],
      [{ label: "Открыть предложение", to: `${base}#offer` }, history!],
    );
  }
  if (/документ|загруз|выписк|pdf|после отправки/.test(q)) {
    const requests =
      a?.information_requests.filter((r) => r.status === "OPEN") || [];
    const requestText = requests.length
      ? `Банк запросил:\n${requests.map((r) => `• ${r.message}`).join("\n")}`
      : "В выбранном контексте нет открытого запроса банка. Обязательный перечень документов в доступных данных не указан.";
    const files = a?.documents.length
      ? `По заявке добавлено файлов: ${a.documents.length}. ${a.documents.map((d) => d.file_name).join(", ")}.`
      : "Документы в этом контексте пока не добавлены.";
    const why = /выписк/.test(q)
      ? "Выписка обычно помогает сопоставить поступления и расходы бизнеса. Причина запроса по конкретной заявке определяется только сообщением банка.\n\n"
      : "";
    return reply(
      `${why}${requestText}\n\n${files}\n\nВ демо разрешён PDF до 5 МБ, загрузка доступна в черновике и при уточнении. Сохраняются только сведения о файле. После ответа на запрос нужно явно нажать «Отправить уточнения»; помощник не делает это автоматически.`,
      a
        ? [
            source,
            {
              label: `Документы заявки №${shortId(a.id)} · демоданные`,
              to: documents.to,
            },
          ]
        : [
            {
              label: "Раздел документов · локальный деморежим",
              to: documents.to,
            },
          ],
      [documents, ...(base ? [{ label: "Открыть заявку", to: base }] : [])],
    );
  }
  if (/статус|дальше|рассмотр|отказ|задерж|решени|одобр|отправ.*заявк/.test(q))
    return statusAnswer();
  if (/кредит|программ|продукт|срок|сумм|услов/.test(q)) {
    const chosen = context.type === "product" ? context.product : null;
    const lines = (chosen ? [chosen] : products).map(
      (p) =>
        `${p.name}: ${p.description}. Сумма ${money(p.min_amount)}–${money(p.max_amount)}, срок ${p.min_term}–${p.max_term} мес., демо-ставка ${p.annual_rate}% годовых.`,
    );
    return reply(
      `${lines.join("\n\n")}\n\nСрок следует сопоставить с задачей бизнеса и посильным ежемесячным платежом. Более долгий срок обычно уменьшает платёж и увеличивает общую сумму процентов. Условия в прототипе синтетические и не являются обещанием банка.`,
      [
        chosen
          ? {
              label: `${chosen.name} · каталог демопродуктов`,
              to: `/client/products?product=${chosen.id}`,
            }
          : catalog,
      ],
      [
        { label: "Сравнить продукты", to: "/client/products" },
        ...(chosen
          ? [
              {
                label: "Перейти к оформлению",
                to: `/client/applications/new?product=${chosen.id}`,
              },
            ]
          : []),
      ],
    );
  }
  return reply(
    "Я работаю как локальный справочный помощник без LLM. По этому вопросу достоверного ответа в доступных данных нет. Могу объяснить продукты, статус, документы и предложение банка. Выберите быстрый вопрос или откройте нужный раздел.",
    a ? [source] : [catalog],
    a
      ? [{ label: "Открыть заявку", to: base! }]
      : [{ label: "Кредитные продукты", to: "/client/products" }],
  );
}

function abortIfNeeded(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Запрос отменён", "AbortError");
}
export const localAssistantService: AssistantService = {
  async respond(context, question, signal) {
    abortIfNeeded(signal);
    if (!question.trim()) throw new Error("Введите вопрос.");
    const original = applicationOf(context);
    let fresh = context;
    if (original) {
      // The read-only adapter checks ownership again for every response.
      const application = await demo.application(original.id, context.owner);
      fresh = { ...context, application } as AssistantContext;
    }
    const products = await demo.products();
    abortIfNeeded(signal);
    return buildReply(fresh, question, products);
  },
};
