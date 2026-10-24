import { useRef, useState } from "react";
import { Alert, Button, PasswordInput, TextInput } from "@mantine/core";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useSession } from "../../app/session";
import { serverLogin } from "../../shared/api/server";
import { setDataMode } from "../../shared/api/data";
import { sessionHome } from "../../shared/api/identity";
import { ErrorMessage } from "../../components/ui/common";
export function ServerLogin() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (session) return <Navigate to={sessionHome(session)} replace />;
  return (
    <main className="login auth-page">
      <div className="login-intro">
        <div className="brand">
          <b>а</b>
          <div>
            альфа<small>БИЗНЕС · DEMO API</small>
          </div>
        </div>
        <div>
          <h1>Серверный кабинет</h1>
          <p>Реальные запросы к FastAPI проекта и данные его базы.</p>
        </div>
      </div>
      <section className="login-form panel">
        <h2>Вход через сервер проекта</h2>
        <Alert color="gray">
          Учебный API с синтетическими данными. Роль определяет сервер.
          Регистрация и администрирование этого API пока не подключены. После
          перезагрузки страницы сеанс проверяется сервером. Используется учебный
          Bearer-доступ; токен хранится только в sessionStorage текущей вкладки.
        </Alert>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setError(null);
            try {
              const s = await serverLogin(username, password);
              setDataMode("api");
              setSession(s);
              navigate(sessionHome(s));
            } catch (e) {
              setError(e as Error);
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <TextInput
            label="Логин сервера"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />
          <PasswordInput
            label="Пароль сервера"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <ErrorMessage error={error} />
          <Button type="submit" loading={busy}>
            Войти через API
          </Button>
          <Link to="/login">Локальный тестовый кабинет</Link>
          <Link to="/demo-login">Готовые автономные сценарии</Link>
        </form>
      </section>
    </main>
  );
}
