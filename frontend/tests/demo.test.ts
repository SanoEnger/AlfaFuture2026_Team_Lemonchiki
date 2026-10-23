import { beforeEach, describe, expect, it, vi } from "vitest";
import { demo, readApplications } from "../shared/api/demo";
import type { Draft } from "../shared/api/types";
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
const draft: Draft = {
  product_id: "working",
  amount: "400000",
  term_months: 12,
  purpose: "WORKING_CAPITAL",
  company_financials: {
    revenue: "2000000",
    expenses: "700000",
    debt_payment: "10000",
    months_active: 48,
  },
};
beforeEach(() => memory.clear());
describe("автономный кредитный сценарий", () => {
  it("сохраняет черновик, отправляет и завершает предложение без изменения исходной суммы", async () => {
    const a = await demo.saveDraft("client_good", draft);
    expect((await demo.application(a.id)).status).toBe("DRAFT");
    await demo.submit(a.id);
    await demo.decision(a.id, "OFFERED", "Демонстрационный контроффер", {
      amount: "350000",
      term_months: 12,
      annual_rate: "17.5",
    });
    const offered = await demo.application(a.id);
    expect(offered.requested_terms.amount).toBe("400000");
    expect(offered.latest_offer?.amount).toBe("350000");
    await demo.respond(a.id, true);
    const final = await demo.application(a.id);
    expect(final.status).toBe("COMPLETED");
    expect(final.events.map((e) => e.to_status)).toEqual([
      "DRAFT",
      "SUBMITTED",
      "VERIFYING",
      "UNDER_REVIEW",
      "OFFERED",
      "ACCEPTED",
      "COMPLETED",
    ]);
  });
  it("обрабатывает запрос сведений, повторную подачу и отказ с причиной", async () => {
    await demo.requestInfo("SC-1042", "Уточните выручку");
    expect((await demo.application("SC-1042")).status).toBe("NEEDS_INFO");
    await expect(demo.resubmit("SC-1042", "")).rejects.toThrow();
    await demo.resubmit("SC-1042", "Уточнённые сведения");
    await demo.decision("SC-1042", "REJECTED", "Недостаточно доходов");
    const a = await demo.application("SC-1042");
    expect(a.status).toBe("REJECTED");
    expect(a.events.at(-1)?.reason).toBe("Недостаточно доходов");
    expect(a.information_requests[0].status).toBe("RESOLVED");
  });
  it("сохраняет отказ клиента и блокирует повторное принятие", async () => {
    await demo.respond("SC-1038", false);
    expect((await demo.application("SC-1038")).status).toBe("DECLINED");
    await expect(demo.respond("SC-1038", true)).rejects.toThrow();
  });
  it("фильтрует заявки по демопользователю и не выдаёт чужую карточку", async () => {
    expect(
      (await demo.applications("client_good")).every(
        (a) => a.owner === "client_good",
      ),
    ).toBe(true);
    await expect(demo.application("SC-1041", "client_good")).rejects.toThrow(
      "Заявка не найдена",
    );
  });
  it("валидирует продукт и защищает отправленную заявку от обычного редактирования", async () => {
    await expect(
      demo.saveDraft("client_good", { ...draft, amount: "0" }),
    ).rejects.toThrow();
    await expect(
      demo.saveDraft("client_good", draft, "SC-1042"),
    ).rejects.toThrow();
    expect(
      readApplications().find((a) => a.id === "SC-1042")?.requested_terms
        .amount,
    ).toBe("3200000");
  });
  it("показывает разные подборки новостей", async () => {
    const good = await demo.news("client_good");
    const risky = await demo.news("client_risky");
    expect(good.map((n) => n.id)).not.toEqual(risky.map((n) => n.id));
  });
});
