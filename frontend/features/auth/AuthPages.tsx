import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Button, PasswordInput, TextInput } from "@mantine/core";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../../app/session";
import { identity, sessionHome } from "../../shared/api/identity";
import { ErrorMessage } from "../../components/ui/common";
import { date } from "../../shared/format";
import { setDataMode } from "../../shared/api/data";

export function AuthLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="login auth-page">
      <div className="login-intro">
        <Link className="brand" to="/login">
          <b>а</b>
          <div>
            альфа<small>БИЗНЕС · ДЕМО</small>
          </div>
        </Link>
        <div>
          <span className="eyebrow">SMART CREDIT</span>
          <h1>
            Кабинет для
            <br />
            вашего бизнеса
          </h1>
          <p>Заявки, документы и решения в одном месте.</p>
        </div>
        <span className="muted">
          Учебный проект · Только синтетические данные
        </span>
      </div>
      <section className="login-form panel">
        <h2>{title}</h2>
        <Alert color="gray" className="auth-demo-notice">
          Автономный деморежим. Серверная авторизация и отправка писем не
          подключены. Используйте вымышленные данные и отдельный тестовый
          пароль.
        </Alert>
        {children}
        <div className="auth-links">
          <Link to="/demo-mailbox">Демонстрационная почта</Link>
          <Link to="/demo-login">Готовые демосценарии</Link>
        </div>
      </section>
    </main>
  );
}
export function LoginPage() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (session) return <Navigate to={sessionHome(session)} replace />;
  return (
    <AuthLayout title="Вход в кабинет">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError(null);
          try {
            setDataMode("demo");
            const s = await identity.login(email, password);
            setSession(s);
            navigate(sessionHome(s), { replace: true });
          } catch (e) {
            setError(e as Error);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <TextInput
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <PasswordInput
          label="Пароль"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />
        <ErrorMessage error={error} />
        <Button type="submit" fullWidth loading={busy}>
          Войти
        </Button>
        <div className="auth-links">
          <Link to="/register">Создать кабинет</Link>
          <Link to="/forgot-password">Забыли пароль?</Link>
          <Link to="/server-login">Вход через сервер проекта</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
type AuthMode = "register" | "verify" | "forgot" | "reset" | "invitation";
const titles: Record<AuthMode, string> = {
  register: "Создать кабинет",
  verify: "Подтверждение email",
  forgot: "Восстановить пароль",
  reset: "Новый пароль",
  invitation: "Активация сотрудника",
};
export function AuthPage({ mode }: { mode: AuthMode }) {
  const [params, setParams] = useSearchParams();
  const token = params.get("token") || "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);
  const lock = useRef(false);
  const [invitation, setInvitation] = useState<{
    email: string;
    expiresAt: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    if (mode === "invitation")
      identity
        .invitation(token)
        .then((i) => {
          if (active) setInvitation(i);
        })
        .catch((e) => {
          if (active) setError(e);
        });
    return () => {
      active = false;
    };
  }, [mode, token]);
  const hasPassword = ["register", "reset", "invitation"].includes(mode);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (hasPassword && password !== confirm)
        throw new Error("Пароли не совпадают");
      if (mode === "register") await identity.register(name, email, password);
      if (mode === "verify") await identity.verify(token);
      if (mode === "forgot") await identity.forgot(email);
      if (mode === "reset") await identity.resetPassword(token, password);
      if (mode === "invitation")
        await identity.acceptInvitation(token, name, password);
      setDone(true);
      if (token) setParams({}, { replace: true });
    } catch (e) {
      setError(e as Error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <AuthLayout title={titles[mode]}>
      {done ? (
        <div role="status">
          <h3>
            {mode === "register"
              ? "Проверьте демонстрационную почту"
              : mode === "forgot"
                ? "Если аккаунт существует, инструкция подготовлена"
                : mode === "verify"
                  ? "Email подтверждён"
                  : mode === "invitation"
                    ? "Аккаунт сотрудника активирован"
                    : "Пароль изменён"}
          </h3>
          <p>
            {mode === "register" || mode === "forgot"
              ? "Письмо доступно в локальной демонстрационной почте. Внешняя отправка не выполняется."
              : "Войдите в кабинет с вашими данными."}
          </p>
          <Link to="/login">Перейти ко входу</Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {(mode === "register" || mode === "invitation") && (
            <TextInput
              label="Имя"
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
          )}
          {(mode === "register" || mode === "forgot") && (
            <TextInput
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
          )}
          {mode === "invitation" && invitation && (
            <Alert color="gray">
              <p>Приглашение для {invitation.email}</p>
              <p>
                Действует до {date(invitation.expiresAt)}. Роль: сотрудник
                банка.
              </p>
            </Alert>
          )}
          {mode === "verify" && (
            <p>
              {token
                ? "Подтвердите переход по одноразовой ссылке. Срок действия — 1 час."
                : "Ссылка подтверждения отсутствует. Откройте письмо или запросите новое."}
            </p>
          )}
          {hasPassword && (
            <>
              <PasswordInput
                label="Новый пароль"
                description="От 10 до 128 символов, буквы и цифры"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              <PasswordInput
                label="Повторите пароль"
                required
                autoComplete="new-password"
                error={
                  confirm && password !== confirm
                    ? "Пароли не совпадают"
                    : undefined
                }
                value={confirm}
                onChange={(e) => setConfirm(e.currentTarget.value)}
              />
            </>
          )}
          <ErrorMessage error={error} />
          <Button
            type="submit"
            fullWidth
            loading={busy}
            disabled={
              ((mode === "verify" || mode === "reset") && !token) ||
              (mode === "invitation" && !invitation)
            }
          >
            {mode === "register"
              ? "Зарегистрироваться"
              : mode === "verify"
                ? "Подтвердить email"
                : mode === "forgot"
                  ? "Получить инструкцию"
                  : mode === "invitation"
                    ? "Активировать аккаунт"
                    : "Сохранить пароль"}
          </Button>
          <Link to="/login">Вернуться ко входу</Link>
        </form>
      )}
      {mode === "verify" && !done && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await identity.resend(email);
              setError(null);
              setResent(true);
            } catch (e) {
              setError(e as Error);
            }
          }}
        >
          <TextInput
            label="Email для нового письма"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <Button type="submit" variant="default">
            Запросить новое письмо
          </Button>
          {resent && (
            <p role="status">
              Если аккаунт ожидает подтверждения, новое письмо доступно в
              демонстрационной почте.
            </p>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
export function DemoMailbox() {
  const mail = identity.listMail();
  return (
    <AuthLayout title="Демонстрационная почта">
      <p>
        Локальные тестовые письма этого браузера. Это открытый инструмент
        деморежима, не реальный почтовый ящик.
      </p>
      {mail.length ? (
        mail.map((m) => (
          <article className="demo-mail" key={m.id}>
            <h3>{m.subject}</h3>
            <p>Кому: {m.to}</p>
            <small>{date(m.createdAt)}</small>
            <p>
              <Link to={m.link}>Открыть письмо: {m.subject}</Link>
            </p>
          </article>
        ))
      ) : (
        <p>
          Писем пока нет. Зарегистрируйте тестовый аккаунт или создайте
          приглашение.
        </p>
      )}
      <Link to="/login">Войти в кабинет</Link>
    </AuthLayout>
  );
}
