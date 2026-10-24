import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReply,
  localAssistantService,
  quickQuestions,
} from "../src/features/assistant/assistantContent";
import type { AssistantContext } from "../src/features/assistant/types";
import { application, product } from "./fixtures";
import { data } from "../shared/api/data";
const products = [product];
function readApplications() {
  const a = application();
  return [
    a,
    {
      ...a,
      id: "SC-1038",
      status: "OFFERED" as const,
      latest_offer: {
        amount: "1500000",
        term_months: 24,
        annual_rate: "18",
        reason: "",
        created_at: "2026-10-24",
      },
    },
    {
      ...a,
      id: "SC-1035",
      status: "NEEDS_INFO" as const,
      information_requests: [
        {
          id: "req",
          message: "Приложите выписку по расчётному счёту",
          status: "OPEN" as const,
          created_at: "2026-10-24",
        },
      ],
    },
  ];
}
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
beforeEach(() => {
  memory.clear();
  vi.restoreAllMocks();
  vi.spyOn(data, "application").mockImplementation(async (id, owner) => {
    if (owner === "client_risky") throw Error("Заявка не найдена");
    return readApplications().find((a) => a.id === id)!;
  });
  vi.spyOn(data, "products").mockResolvedValue(products);
});
function context(id = "case-1042"): AssistantContext {
  const application = readApplications().find((a) => a.id === id)!;
  return {
    type: application.latest_offer ? "offer" : "application",
    contextKey: `client_good:${id}`,
    owner: application.owner,
    application,
  };
}
describe("контекстный локальный помощник", () => {
  it("объясняет статус по данным заявки и ссылается на существующую историю", () => {
    const r = buildReply(context(), "Что со статусом?", products);
    expect(r.text).toContain("CASE-104");
    expect(r.text).toContain("На рассмотрении");
    expect(r.text).toContain(
      "Срок решения и причина ожидания в доступных данных не указаны",
    );
    expect(r.sources[0].to).toBe("/client/applications/case-1042#history");
  });
  it("сравнивает настоящий оффер и не выдумывает причину отсутствующего комментария", () => {
    const c = context("SC-1038");
    if (!("application" in c) || !c.application?.latest_offer)
      throw Error("fixture");
    c.application.latest_offer.reason = "";
    const r = buildReply(c, "Почему сумма меньше?", products);
    expect(r.text).toContain("1 800 000");
    expect(r.text).toContain("1 500 000");
    expect(r.text).toContain("Причина изменения условий не указана");
    expect(
      r.actions.every((a) => a.to.startsWith("/client/applications/SC-1038#")),
    ).toBe(true);
  });
  it("выводит конкретный запрос банка и только документы этой заявки", () => {
    const r = buildReply(context("SC-1035"), "Какие документы?", products);
    expect(r.text).toContain("Приложите выписку по расчётному счёту");
    expect(r.text).not.toContain("Бухгалтерская_отчётность.pdf");
    expect(r.actions[0].to).toBe("/client/documents?application=SC-1035");
  });
  it("сохраняет read-only поведение и повторно проверяет владельца", async () => {
    const before = JSON.stringify(readApplications());
    const c = context();
    await localAssistantService.respond(
      c,
      "Одобри и отправь заявку",
      new AbortController().signal,
    );
    expect(JSON.stringify(readApplications())).toBe(before);
    await expect(
      localAssistantService.respond(
        { ...c, owner: "client_risky" },
        "Статус",
        new AbortController().signal,
      ),
    ).rejects.toThrow("Заявка не найдена");
  });
  it("перечитывает изменённые данные вместо ответа из устаревшего снимка", async () => {
    const old = context();
    vi.spyOn(data, "application").mockResolvedValue({
      ...application(),
      status: "NEEDS_INFO",
      information_requests: [
        {
          id: "req",
          message: "Уточните выручку за октябрь",
          status: "OPEN",
          created_at: "2026-10-24",
        },
      ],
    });
    const r = await localAssistantService.respond(
      old,
      "Что дальше?",
      new AbortController().signal,
    );
    expect(r.text).toContain("Нужны сведения");
    expect(r.text).toContain("Уточните выручку за октябрь");
  });
  it("отменяет запрос и сообщает об отсутствии достоверного ответа", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      localAssistantService.respond(context(), "Статус", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    const r = buildReply(
      { type: "general", owner: "client_good", contextKey: "general" },
      "Прогноз погоды",
      products,
    );
    expect(r.text).toContain("достоверного ответа в доступных данных нет");
    expect(r.actions[0].to).toBe("/client/products");
  });
  it("ограничивает быстрые вопросы тремя для каждого вида контекста", () => {
    for (const c of [
      context(),
      context("SC-1038"),
      {
        type: "documents",
        application: null,
        owner: "client_good",
        contextKey: "docs",
      } as const,
      {
        type: "product",
        product: products[0],
        owner: "client_good",
        contextKey: "product",
      } as const,
    ])
      expect(quickQuestions(c)).toHaveLength(3);
  });
});
