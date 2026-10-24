/** Isolated browser demo only. Not server authentication or an access-control boundary. */
import type { Role, Session } from "./types";
import { DemoError } from "./errors";
import { readCompanies } from "./companyStore";
export interface DemoUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  hash: string;
  salt: string;
  version: number;
  createdAt: string;
  lastLogin?: string;
}
export interface Invitation {
  id: string;
  email: string;
  role: "BANK_OFFICER";
  expiresAt: string;
  status: "PENDING" | "USED" | "REVOKED";
  tokenHash: string;
  createdAt: string;
}
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  object: string;
  createdAt: string;
}
interface Mail {
  id: string;
  to: string;
  subject: string;
  link: string;
  createdAt: string;
}
interface Token {
  hash: string;
  userId: string;
  type: "verify" | "reset";
  expires: number;
  used: boolean;
}
interface Store {
  users: DemoUser[];
  invitations: Invitation[];
  audit: AuditEntry[];
  mail: Mail[];
  tokens: Token[];
}
const key = "smart-credit-identity-demo-v1";
const read = (): Store =>
  JSON.parse(
    localStorage.getItem(key) ||
      '{"users":[],"invitations":[],"audit":[],"mail":[],"tokens":[]}',
  );
const write = (s: Store) => localStorage.setItem(key, JSON.stringify(s));
const now = () => new Date(Date.now()).toISOString();
const normalEmail = (email: string) => email.trim().toLowerCase();
const bytes = (size: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(size)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function digest(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function passwordHash(password: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 210000,
    },
    material,
    256,
  );
  return Array.from(new Uint8Array(bits), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function validateCredentials(email: string, password?: string) {
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalEmail(email)) ||
    email.length > 254
  )
    throw new DemoError(422, "Укажите корректный email");
  if (
    password !== undefined &&
    (password.length < 10 ||
      password.length > 128 ||
      !/[a-zа-я]/i.test(password) ||
      !/\d/.test(password))
  )
    throw new DemoError(422, "Пароль: 10–128 символов, буквы и цифры");
}
function audit(s: Store, actor: string, action: string, object: string) {
  s.audit.unshift({
    id: crypto.randomUUID(),
    actor,
    action,
    object,
    createdAt: now(),
  });
}
function requireAdmin(actor: Session) {
  if (
    actor.role !== "BANK_ADMIN" ||
    (!actor.demoAccount && !identity.validate(actor))
  )
    throw new DemoError(403, "Требуются права администратора");
}
async function sendToken(user: DemoUser, type: Token["type"]) {
  const raw = bytes(32);
  const hash = await digest(raw);
  const s = read();
  s.tokens
    .filter((t) => t.userId === user.id && t.type === type)
    .forEach((t) => {
      t.used = true;
    });
  s.tokens.push({
    hash,
    userId: user.id,
    type,
    expires: Date.now() + 60 * 60 * 1000,
    used: false,
  });
  s.mail.unshift({
    id: crypto.randomUUID(),
    to: user.email,
    subject:
      type === "verify" ? "Подтверждение email" : "Восстановление пароля",
    link: `/${type === "verify" ? "verify-email" : "reset-password"}?token=${raw}`,
    createdAt: now(),
  });
  write(s);
}
export const identity = {
  listMail: () => read().mail,
  staff: () =>
    read()
      .users.filter((u) => u.role !== "CLIENT")
      .map(({ hash, salt, ...u }) => u),
  invitations: () => read().invitations.map(({ tokenHash, ...i }) => i),
  audit: () => read().audit,
  user: (id: string) => {
    const u = read().users.find((u) => u.id === id);
    if (!u) return null;
    const { hash, salt, ...safe } = u;
    return safe;
  },
  validate: (session: Session) => {
    const u = read().users.find((u) => u.id === session.username);
    return (
      !!u &&
      u.status === "ACTIVE" &&
      u.version === session.sessionVersion &&
      u.role === session.role
    );
  },
  register: async (displayName: string, email: string, password: string) => {
    validateCredentials(email, password);
    if (!displayName.trim() || displayName.length > 100)
      throw new DemoError(422, "Укажите имя до 100 символов");
    const salt = bytes(16);
    const hash = await passwordHash(password, salt);
    const s = read();
    if (s.users.some((u) => u.email === normalEmail(email)))
      throw new DemoError(
        409,
        "Невозможно создать аккаунт с этими данными. Попробуйте войти или восстановить доступ.",
      );
    const user: DemoUser = {
      id: crypto.randomUUID(),
      email: normalEmail(email),
      displayName: displayName.trim(),
      role: "CLIENT",
      status: "PENDING",
      salt,
      hash,
      version: 1,
      createdAt: now(),
    };
    s.users.push(user);
    write(s);
    await sendToken(user, "verify");
  },
  verify: async (raw: string) => {
    const hash = await digest(raw);
    const s = read();
    const t = s.tokens.find((t) => t.hash === hash && t.type === "verify");
    if (!t || t.used || t.expires < Date.now())
      throw new DemoError(
        422,
        "Ссылка недействительна, использована или срок истёк",
      );
    const u = s.users.find((u) => u.id === t.userId)!;
    u.status = "ACTIVE";
    t.used = true;
    write(s);
  },
  resend: async (email: string) => {
    const u = read().users.find(
      (u) => u.email === normalEmail(email) && u.status === "PENDING",
    );
    if (u) await sendToken(u, "verify");
  },
  login: async (email: string, password: string): Promise<Session> => {
    const u = read().users.find((u) => u.email === normalEmail(email));
    if (!u || (await passwordHash(password, u.salt)) !== u.hash)
      throw new DemoError(401, "Неверный email или пароль");
    if (u.status !== "ACTIVE")
      throw new DemoError(
        403,
        u.status === "PENDING"
          ? "Подтвердите email перед входом"
          : "Доступ к аккаунту приостановлен",
      );
    const s = read();
    const current = s.users.find((x) => x.id === u.id)!;
    if (current.status !== "ACTIVE" || current.version !== u.version)
      throw new DemoError(401, "Аккаунт изменился. Войдите снова");
    current.lastLogin = now();
    audit(s, u.id, "Вход", u.id);
    write(s);
    return {
      username: u.id,
      role: u.role,
      email: u.email,
      displayName: u.displayName,
      onboardingComplete: !!readCompanies()[u.id],
      sessionVersion: u.version,
      issuedAt: Date.now(),
    };
  },
  forgot: async (email: string) => {
    validateCredentials(email);
    const u = read().users.find(
      (u) => u.email === normalEmail(email) && u.status === "ACTIVE",
    );
    if (u) await sendToken(u, "reset");
  },
  resetPassword: async (raw: string, password: string) => {
    const hash = await digest(raw);
    const salt = bytes(16);
    const nextHash = await passwordHash(password, salt);
    const s = read();
    const t = s.tokens.find((t) => t.hash === hash && t.type === "reset");
    if (!t || t.used || t.expires < Date.now())
      throw new DemoError(
        422,
        "Ссылка недействительна, использована или срок истёк",
      );
    const u = s.users.find((u) => u.id === t.userId)!;
    validateCredentials(u.email, password);
    u.hash = nextHash;
    u.salt = salt;
    u.version++;
    t.used = true;
    audit(s, u.id, "Пароль изменён", u.id);
    write(s);
  },
  invite: async (actor: Session, email: string) => {
    requireAdmin(actor);
    validateCredentials(email);
    const raw = bytes(32);
    const tokenHash = await digest(raw);
    const s = read();
    if (
      s.users.some((u) => u.email === normalEmail(email)) ||
      s.invitations.some(
        (i) =>
          i.email === normalEmail(email) &&
          i.status === "PENDING" &&
          i.expiresAt > now(),
      )
    )
      throw new DemoError(
        409,
        "Аккаунт или действующее приглашение уже существует",
      );
    const i: Invitation = {
      id: crypto.randomUUID(),
      email: normalEmail(email),
      role: "BANK_OFFICER",
      status: "PENDING",
      tokenHash,
      createdAt: now(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };
    s.invitations.unshift(i);
    s.mail.unshift({
      id: crypto.randomUUID(),
      to: i.email,
      subject: "Приглашение сотрудника",
      link: `/accept-invitation?token=${raw}`,
      createdAt: now(),
    });
    audit(s, actor.username, "Приглашение создано", i.id);
    write(s);
  },
  invitation: async (raw: string) => {
    const hash = await digest(raw);
    const i = read().invitations.find((i) => i.tokenHash === hash);
    if (!i || i.status !== "PENDING" || i.expiresAt < now())
      throw new DemoError(
        422,
        "Приглашение использовано, отозвано или истекло",
      );
    return { email: i.email, expiresAt: i.expiresAt };
  },
  acceptInvitation: async (raw: string, name: string, password: string) => {
    const hash = await digest(raw);
    const salt = bytes(16);
    const passwordDigest = await passwordHash(password, salt);
    const s = read();
    const i = s.invitations.find((i) => i.tokenHash === hash);
    if (!i || i.status !== "PENDING" || i.expiresAt < now())
      throw new DemoError(
        422,
        "Приглашение использовано, отозвано или истекло",
      );
    validateCredentials(i.email, password);
    if (!name.trim()) throw new DemoError(422, "Укажите имя");
    if (s.users.some((u) => u.email === i.email))
      throw new DemoError(409, "Email уже используется");
    const u: DemoUser = {
      id: crypto.randomUUID(),
      email: i.email,
      displayName: name.trim(),
      role: i.role,
      status: "ACTIVE",
      salt,
      hash: passwordDigest,
      version: 1,
      createdAt: now(),
    };
    s.users.push(u);
    i.status = "USED";
    audit(s, u.id, "Приглашение принято", i.id);
    write(s);
  },
  revoke: (actor: Session, id: string) => {
    requireAdmin(actor);
    const s = read();
    const i = s.invitations.find((i) => i.id === id);
    if (!i || i.status !== "PENDING")
      throw new DemoError(409, "Приглашение уже обработано");
    i.status = "REVOKED";
    audit(s, actor.username, "Приглашение отозвано", id);
    write(s);
  },
  suspend: (actor: Session, id: string, suspend: boolean) => {
    requireAdmin(actor);
    const s = read();
    const u = s.users.find((u) => u.id === id && u.role === "BANK_OFFICER");
    if (!u) throw new DemoError(404, "Сотрудник не найден");
    u.status = suspend ? "SUSPENDED" : "ACTIVE";
    u.version++;
    audit(
      s,
      actor.username,
      suspend ? "Доступ заблокирован" : "Доступ восстановлен",
      id,
    );
    write(s);
  },
  updateProfile: (session: Session, name: string) => {
    if (!identity.validate(session) || !name.trim())
      throw new DemoError(422, "Проверьте имя и сеанс");
    const s = read();
    s.users.find((u) => u.id === session.username)!.displayName = name.trim();
    write(s);
    return { ...session, displayName: name.trim() };
  },
  changePassword: async (
    session: Session,
    currentPassword: string,
    nextPassword: string,
  ) => {
    if (!identity.validate(session)) throw new DemoError(401, "Войдите снова");
    const old = read().users.find((u) => u.id === session.username)!;
    validateCredentials(old.email, nextPassword);
    if ((await passwordHash(currentPassword, old.salt)) !== old.hash)
      throw new DemoError(422, "Текущий пароль неверен");
    const salt = bytes(16);
    const hash = await passwordHash(nextPassword, salt);
    const s = read();
    const u = s.users.find((u) => u.id === session.username)!;
    if (u.version !== session.sessionVersion)
      throw new DemoError(409, "Сеанс изменился. Войдите снова");
    u.hash = hash;
    u.salt = salt;
    u.version++;
    audit(s, u.id, "Пароль изменён", u.id);
    write(s);
  },
  recordAssignment: (
    actor: Session,
    id: string,
    previous: string | null,
    next: string,
  ) => {
    const s = read();
    audit(
      s,
      actor.username,
      `Ответственный: ${previous || "не назначен"} → ${next}`,
      id,
    );
    write(s);
  },
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
