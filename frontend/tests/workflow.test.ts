import { describe, expect, it, beforeEach, vi } from "vitest";
import { deriveNextAction } from "../features/applications/deriveNextAction";
import { application, product } from "./fixtures";
import type { Status, Draft, Application } from "../shared/api/types";
import { minorUnits, validateDraft } from "../shared/validation";
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
beforeEach(() => memory.clear());
describe("следующее действие", () => {
  for (const status of [
    "DRAFT",
    "SUBMITTED",
    "VERIFYING",
    "NEEDS_INFO",
    "UNDER_REVIEW",
    "OFFERED",
    "REJECTED",
    "ACCEPTED",
    "DECLINED",
    "COMPLETED",
  ] as Status[]) {
    it(`объясняет ${status} без неподтверждённых действий`, async () => {
      const a = application();
      a.status = status;
      a.latest_offer = null;
      a.information_requests = [];
      const next = deriveNextAction(a);
      expect(next.title.length).toBeGreaterThan(5);
      expect(next.description.length).toBeGreaterThan(5);
      if (
        [
          "SUBMITTED",
          "VERIFYING",
          "UNDER_REVIEW",
          "NEEDS_INFO",
          "OFFERED",
          "ACCEPTED",
        ].includes(status)
      )
        expect(next.action).toBeUndefined();
      if (next.action) expect(next.action.to).toContain(a.id);
    });
  }
  it("использует только действующие запросы и фактический оффер", async () => {
    const a: Application = {
      ...application(),
      status: "NEEDS_INFO",
      information_requests: [
        {
          id: "request",
          message: "Уточните данные",
          status: "OPEN",
          created_at: "2026-10-24",
        },
      ],
    };
    expect(deriveNextAction(a).description).toContain(
      a.information_requests[0].message,
    );
    expect(deriveNextAction(a).action?.to).toContain("#documents");
    a.information_requests[0].status = "RESOLVED";
    expect(deriveNextAction(a).action).toBeUndefined();
    const o = {
      ...application(),
      status: "OFFERED" as const,
      latest_offer: {
        amount: "1500000",
        term_months: 24,
        annual_rate: "18",
        reason: "Условия",
        created_at: "2026-10-24",
      },
    };
    expect(deriveNextAction(o).action?.to).toContain("#offer");
  });
});
describe("денежные значения и ошибки адаптера", () => {
  it("обрабатывает копейки без float и отбрасывает некорректные значения", () => {
    expect(minorUnits("9007199254740993.01")).toBe(900719925474099301n);
    for (const value of ["", "NaN", "-1", "1.001", "Infinity", "1e6"])
      expect(minorUnits(value)).toBeNull();
  });
  it("возвращает 422 для невалидных финансов и 409 для устаревшего перехода", async () => {
    const a = application();
    const d: Draft = {
      ...a.requested_terms,
      company_financials: { ...a.company, revenue: "NaN" },
    };
    expect(validateDraft(d, product).revenue).toBeTruthy();
  });
});
