import { request, clearCsrf } from "./http";
import { serverLogin, restoreServerSession } from "./server";
import type { Role, Session } from "./types";
export interface Staff {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: string;
  createdAt: string;
  lastLogin?: string | null;
}
export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: "PENDING" | "USED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
}
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  object: string;
  createdAt: string;
}
const directory = new Map<
  string,
  { id: string; displayName: string; status: string; role: Role }
>();
const post = (body: unknown) => ({
  method: "POST",
  body: JSON.stringify(body),
});
export const identity = {
  login: serverLogin,
  register: (name: string, email: string, password: string) =>
    request("/auth/register", post({ name, email, password })),
  verify: (token: string) => request("/auth/verify-email", post({ token })),
  resend: (email: string) =>
    request("/auth/verify-email/resend", post({ email })),
  forgot: (email: string) => request("/auth/password/forgot", post({ email })),
  resetPassword: (token: string, password: string) =>
    request("/auth/password/reset", post({ token, password })),
  invitation: (token: string) =>
    request<{ email: string; expiresAt: string }>(
      "/auth/invitations/inspect",
      post({ token }),
    ),
  acceptInvitation: (token: string, name: string, password: string) =>
    request("/auth/invitations/accept", post({ token, name, password })),
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearCsrf();
      directory.clear();
    }
  },
  staff: async () => {
    const users = await request<Staff[]>("/admin/staff");
    for (const u of users) directory.set(u.id, u);
    return users;
  },
  officers: async () => {
    const users =
      await request<
        Array<{ id: string; displayName: string; status: string; role: Role }>
      >("/bank/officers");
    for (const u of users) directory.set(u.id, u);
    return users;
  },
  invitations: () => request<Invitation[]>("/admin/staff/invitations"),
  audit: () => request<AuditEntry[]>("/admin/audit"),
  user: (id: string) => directory.get(id) || null,
  invite: (_actor: Session, email: string) =>
    request("/admin/staff/invitations", post({ email })),
  revoke: (_actor: Session, id: string) =>
    request(`/admin/staff/invitations/${id}/revoke`, { method: "POST" }),
  suspend: (_actor: Session, id: string, suspend: boolean) =>
    request(`/admin/staff/${id}/${suspend ? "suspend" : "reactivate"}`, {
      method: "POST",
    }),
  updateProfile: async (_session: Session, name: string) => {
    await request("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    return restoreServerSession();
  },
  changePassword: (
    _session: Session,
    currentPassword: string,
    password: string,
  ) =>
    request(
      "/auth/password/change",
      post({ current_password: currentPassword, password }),
    ),
};
export function sessionHome(s: Session) {
  return s.role === "CLIENT"
    ? s.onboardingComplete === false
      ? "/client/onboarding"
      : "/client/dashboard"
    : s.role === "BANK_ADMIN"
      ? "/bank/administration"
      : "/bank/applications";
}
