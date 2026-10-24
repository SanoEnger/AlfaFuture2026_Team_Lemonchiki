import { beforeEach, describe, expect, it, vi } from "vitest";
import { identity, sessionHome } from "../shared/api/identity";
import { canDecide, demo } from "../shared/api/demo";
import type { Session } from "../shared/api/types";
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
beforeEach(() => memory.clear());
const admin: Session = {
  username: "demo_admin",
  role: "BANK_ADMIN",
  demoAccount: true,
};
const officer: Session = {
  username: "banker",
  role: "BANK_EMPLOYEE",
  demoAccount: true,
};
const other: Session = {
  username: "banker_two",
  role: "BANK_OFFICER",
  demoAccount: true,
};
const token = () =>
  new URL(identity.listMail()[0].link, "http://demo").searchParams.get(
    "token",
  )!;
describe("автономные сценарии доступа", () => {
  it("регистрирует только клиента, подтверждает одноразово и направляет в onboarding", async () => {
    await identity.register("Тест", "TEST@example.test", "TestPassword123");
    expect(memory.get("smart-credit-identity-demo-v1")).not.toContain(
      "TestPassword123",
    );
    await expect(
      identity.login("test@example.test", "TestPassword123"),
    ).rejects.toMatchObject({ status: 403 });
    const t = token();
    await identity.verify(t);
    await expect(identity.verify(t)).rejects.toMatchObject({ status: 422 });
    const s = await identity.login("test@example.test", "TestPassword123");
    expect(s.role).toBe("CLIENT");
    expect(sessionHome(s)).toBe("/client/onboarding");
  });
  it("не позволяет сотруднику приглашать и не преобразует CLIENT в банк", async () => {
    await expect(
      identity.invite(officer, "staff@example.test"),
    ).rejects.toMatchObject({ status: 403 });
    await identity.register("Клиент", "client@example.test", "ClientPass123");
    await expect(
      identity.invite(admin, "client@example.test"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("приглашение одноразовое, блокировка отзывает сеанс, восстановление не возвращает его", async () => {
    await identity.invite(admin, "officer@example.test");
    const t = token();
    await identity.acceptInvitation(t, "Сотрудник", "OfficerPass123");
    await expect(
      identity.acceptInvitation(t, "Другой", "OfficerPass123"),
    ).rejects.toMatchObject({ status: 422 });
    const s = await identity.login("officer@example.test", "OfficerPass123");
    expect(identity.validate(s)).toBe(true);
    identity.suspend(admin, s.username, true);
    expect(identity.validate(s)).toBe(false);
    identity.suspend(admin, s.username, false);
    expect(identity.validate(s)).toBe(false);
    expect(
      identity.audit().some((e) => e.action === "Доступ заблокирован"),
    ).toBe(true);
  });
  it("отозванная и истёкшая ссылки не активируют аккаунт", async () => {
    await identity.invite(admin, "revoked@example.test");
    const t = token();
    identity.revoke(admin, identity.invitations()[0].id);
    await expect(
      identity.acceptInvitation(t, "Сотрудник", "OfficerPass123"),
    ).rejects.toMatchObject({ status: 422 });
    await identity.invite(admin, "expired@example.test");
    const expired = token();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 49 * 60 * 60 * 1000);
    await expect(identity.invitation(expired)).rejects.toMatchObject({
      status: 422,
    });
    vi.restoreAllMocks();
  });
  it("восстановление меняет пароль и отзывает старые сеансы", async () => {
    await identity.register("Клиент", "client@example.test", "ClientPass123");
    await identity.verify(token());
    const s = await identity.login("client@example.test", "ClientPass123");
    await identity.forgot("absent@example.test");
    await identity.forgot("client@example.test");
    const t = token();
    await identity.resetPassword(t, "ChangedPass123");
    expect(identity.validate(s)).toBe(false);
    await expect(
      identity.login("client@example.test", "ClientPass123"),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      (await identity.login("client@example.test", "ChangedPass123")).role,
    ).toBe("CLIENT");
  });
  it("claim допускает одного сотрудника и исключает администратора из кредитного решения", async () => {
    const results = await Promise.allSettled([
      demo.claim("SC-1041", officer, 1),
      demo.claim("SC-1041", other, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const a = await demo.application("SC-1041");
    expect(canDecide(a, officer)).toBe(true);
    expect(canDecide(a, other)).toBe(false);
    expect(canDecide(a, admin)).toBe(false);
    await expect(
      demo.requestInfo(a.id, "Уточните данные", other, a.version),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      demo.decision(a.id, "REJECTED", "Причина", undefined, admin, a.version),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("устаревший черновик не перезаписывает новую версию", async () => {
    const a = await demo.application("SC-1019");
    const d = {
      ...a.requested_terms,
      company_financials: {
        revenue: a.company.revenue,
        expenses: a.company.expenses,
        debt_payment: a.company.debt_payment,
        months_active: a.company.months_active,
      },
    };
    await demo.saveDraft(a.owner, d, a.id, 1);
    await expect(
      demo.saveDraft(a.owner, { ...d, amount: "900000" }, a.id, 1),
    ).rejects.toMatchObject({ status: 409 });
  });
});
