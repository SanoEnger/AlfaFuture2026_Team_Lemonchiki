import { describe, expect, it, beforeEach, vi } from "vitest";
import { deriveNextAction } from "../features/applications/deriveNextAction";
import { demo } from "../shared/api/demo";
import type { Status, Draft } from "../shared/api/types";
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
      const a = await demo.application("SC-1042");
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
    const a = await demo.application("SC-1035");
    expect(deriveNextAction(a).description).toContain(
      a.information_requests[0].message,
    );
    expect(deriveNextAction(a).action?.to).toContain("#documents");
    a.information_requests[0].status = "RESOLVED";
    expect(deriveNextAction(a).action).toBeUndefined();
    const o = await demo.application("SC-1038");
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
    const a = await demo.application("SC-1042");
    const d: Draft = {
      ...a.requested_terms,
      company_financials: { ...a.company, revenue: "NaN" },
    };
    expect(validateDraft(d, (await demo.products())[0]).revenue).toBeTruthy();
    await expect(demo.saveDraft("client_good", d)).rejects.toMatchObject({
      status: 422,
    });
    await expect(demo.submit(a.id)).rejects.toMatchObject({ status: 409 });
  });
});
