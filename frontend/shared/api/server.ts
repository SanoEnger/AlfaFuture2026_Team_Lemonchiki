import { request, clearCsrf, downloadFile } from "./http";
import type { ApiSchemas } from "./generated";
import type {
  Application,
  Company,
  Draft,
  News,
  Product,
  Risk,
  Session,
  Status,
} from "./types";
import { products } from "./catalog";
import { ApiError } from "./errors";
type WireApplication = ApiSchemas["ApplicationResponse"];
type Bundle = ApiSchemas["BankApplicationResponse"];
let current: Session | null = null;
const json = (body: unknown) => ({
  method: "POST",
  body: JSON.stringify(body),
});
function company(c: ApiSchemas["CompanyResponse"]): Company {
  return {
    ...c,
    revenue: String(c.revenue),
    expenses: String(c.expenses),
    debt_payment: String(c.debt_payment),
  };
}
function application(
  a: WireApplication,
  extra?: Partial<Application>,
): Application {
  return {
    ...a,
    owner: current?.username || "",
    status: a.status as Status,
    requested_terms: {
      ...a.requested_terms,
      amount: String(a.requested_terms.amount),
    },
    company: company(a.company),
    latest_offer: a.latest_offer
      ? {
          ...a.latest_offer,
          amount: String(a.latest_offer.amount),
          annual_rate: String(a.latest_offer.annual_rate),
        }
      : null,
    documents: [],
    information_requests: [],
    events: [],
    risk: null,
    ...extra,
  };
}
function risk(r: Bundle["risk"]): Risk | null {
  if (!r) return null;
  return {
    score: r.score,
    risk_level: r.risk_level as Risk["risk_level"],
    recommendation: r.recommendation,
    rules_version: r.rules_version,
    calculated_at: r.created_at,
    factors: r.factors.map((f) => {
      const x = f as Record<string, unknown>;
      return {
        code: String(x.code || "FACTOR"),
        direction: String(x.direction || "NEUTRAL"),
        points: Number(x.points || 0),
        explanation: String(x.explanation || ""),
      };
    }),
  };
}
export async function serverLogin(
  username: string,
  password: string,
): Promise<Session> {
  await request("/auth/login", json({ email: username, password }));
  return restoreServerSession();
}
export async function restoreServerSession(): Promise<Session> {
  try {
    const me = await request<ApiSchemas["CurrentUserResponse"]>("/auth/me");
    if (
      !["CLIENT", "BANK_EMPLOYEE", "BANK_OFFICER", "BANK_ADMIN"].includes(
        me.role,
      )
    )
      throw new ApiError(403, "Роль сервера не поддерживается этим адаптером");
    const s: Session = {
      username: me.id,
      role: me.role as Session["role"],
      displayName: me.display_name || me.username,
      email: me.email || "",
      onboardingComplete: me.onboarding_complete,
      mode: "api",
      issuedAt: Date.now(),
    };
    const catalog = await request<ApiSchemas["ProductResponse"][]>("/catalog");
    products.splice(
      0,
      products.length,
      ...catalog.map((p) => ({
        ...p,
        min_amount: String(p.min_amount),
        max_amount: String(p.max_amount),
        annual_rate: String(p.annual_rate),
        description:
          p.purpose === "WORKING_CAPITAL"
            ? "Закупки и текущие расходы"
            : "Инвестиции в развитие бизнеса",
      })),
    );
    current = s;
    return s;
  } catch (e) {
    clearCsrf();
    throw e;
  }
}
export const server = {
  claim: async (id: string, _actor: Session, version?: number) =>
    request(
      "/bank/applications/" + id + "/claim",
      json({ expected_version: version }),
    ),
  assign: async (
    id: string,
    _actor: Session,
    officer: string,
    version?: number,
  ) =>
    request(
      "/bank/applications/" + id + "/assign",
      json({ officer_id: officer, expected_version: version }),
    ),
  products: async (): Promise<Product[]> => products,
  company: async (_owner: string) =>
    company(await request<ApiSchemas["CompanyResponse"]>("/business/me")),
  updateCompany: async (_owner: string, c: Company) => {
    if (current?.onboardingComplete === false)
      return company(
        await request<ApiSchemas["CompanyResponse"]>(
          "/organizations",
          json({
            legal_name: c.legal_name,
            inn: c.inn,
            form: c.form,
            industry: c.industry,
            revenue: c.revenue,
            expenses: c.expenses,
            debt_payment: c.debt_payment,
            months_active: c.months_active,
          }),
        ),
      );
    return company(
      await request<ApiSchemas["CompanyResponse"]>("/business/me", {
        method: "PATCH",
        body: JSON.stringify({
          details: { legal_name: c.legal_name, inn: c.inn, form: c.form },
          industry: c.industry,
          financials: {
            revenue: c.revenue,
            expenses: c.expenses,
            debt_payment: c.debt_payment,
            months_active: c.months_active,
          },
        }),
      }),
    );
  },
  applications: async (_owner?: string): Promise<Application[]> => {
    const bank = current?.role !== "CLIENT";
    const list = await request<WireApplication[]>(
      bank ? "/bank/applications" : "/applications",
    );
    return Promise.all(list.map((a) => server.application(a.id)));
  },
  application: async (id: string, _owner?: string): Promise<Application> => {
    if (current?.role !== "CLIENT") {
      const b = await request<Bundle>(
        `/bank/applications/${encodeURIComponent(id)}`,
      );
      return application(b.application, {
        risk: risk(b.risk),
        verifications: b.verifications,
        documents: b.documents,
        events: b.events.map((e) => ({
          ...e,
          to_status: e.to_status as Status,
        })),
        information_requests: b.information_requests.map((r) => ({
          ...r,
          status: r.status as "OPEN" | "RESOLVED",
        })),
      });
    }
    const path = `/applications/${encodeURIComponent(id)}`;
    const [a, events, documents, requests] = await Promise.all([
      request<WireApplication>(path),
      request<ApiSchemas["EventResponse"][]>(`${path}/history`),
      request<ApiSchemas["DocumentResponse"][]>(`${path}/documents`),
      request<ApiSchemas["InfoRequestResponse"][]>(
        `${path}/information-requests`,
      ),
    ]);
    return application(a, {
      documents,
      events: events.map((e) => ({ ...e, to_status: e.to_status as Status })),
      information_requests: requests.map((r) => ({
        ...r,
        status: r.status as "OPEN" | "RESOLVED",
      })),
    });
  },
  saveDraft: async (
    _owner: string,
    draft: Draft,
    id?: string,
    _version?: number,
  ): Promise<Application> => {
    const body = {
      product_id: draft.product_id,
      amount: draft.amount,
      term_months: draft.term_months,
      purpose: draft.purpose,
      comment: draft.comment,
      company_financials: draft.company_financials,
      ...(id && _version ? { expected_version: _version } : {}),
    };
    return application(
      await request<WireApplication>(
        id ? `/applications/${encodeURIComponent(id)}` : "/applications",
        { method: id ? "PATCH" : "POST", body: JSON.stringify(body) },
      ),
    );
  },
  submit: async (id: string) =>
    request(`/applications/${encodeURIComponent(id)}/submit`, {
      method: "POST",
    }),
  resubmit: async (id: string, message: string) =>
    request(
      `/applications/${encodeURIComponent(id)}/resubmit`,
      json(message.trim() ? { response_message: message } : {}),
    ),
  requestInfo: async (
    id: string,
    message: string,
    _actor?: Session,
    version?: number,
  ) =>
    request(
      `/bank/applications/${encodeURIComponent(id)}/request-info`,
      json({ message, expected_version: version }),
    ),
  decision: async (
    id: string,
    type: "OFFERED" | "REJECTED",
    reason: string,
    offer?: { amount: string; term_months: number; annual_rate: string },
    _actor?: Session,
    version?: number,
  ) =>
    request(
      `/bank/applications/${encodeURIComponent(id)}/decision`,
      json({
        type,
        reason,
        expected_version: version,
        ...(offer
          ? {
              offered_amount: offer.amount,
              offered_term_months: offer.term_months,
              offered_annual_rate: offer.annual_rate,
            }
          : {}),
      }),
    ),
  respond: async (id: string, accept: boolean) =>
    request(
      `/applications/${encodeURIComponent(id)}/${accept ? "accept?complete_demo=false" : "decline"}`,
      { method: "POST" },
    ),
  complete: async (id: string, _owner: string) =>
    request(`/applications/${encodeURIComponent(id)}/complete`, {
      method: "POST",
    }),
  upload: async (id: string, file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request(`/applications/${encodeURIComponent(id)}/documents`, {
      method: "POST",
      body: form,
    });
  },
  news: async (_owner: string): Promise<News[]> =>
    (await request<ApiSchemas["NewsResponse"][]>("/news")).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      category: "Материалы для бизнеса",
      industry: n.target_industry || "ALL",
      date: "",
    })),
  download: (id: string, documentId: string, name: string, bank: boolean) =>
    downloadFile(
      bank
        ? `/bank/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`
        : `/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download`,
      name,
    ),
};
