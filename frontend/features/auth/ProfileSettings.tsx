import { useState } from "react";
import { Button, PasswordInput, TextInput } from "@mantine/core";
import { useSession } from "../../app/session";
import { identity } from "../../shared/api/identity";
import { ErrorMessage, Panel } from "../../components/ui/common";
export function ProfileSettings() {
  const { session, setSession } = useSession();
  const [name, setName] = useState(session?.displayName || "");
  const [old, setOld] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  if (session?.mode === "api")
    return (
      <Panel>
        <h3>Профиль сервера</h3>
        <p>
          Роль и доступ определяет сервер проекта. Смена имени и пароля через
          этот API пока не поддерживается.
        </p>
      </Panel>
    );
  if (!session || session.demoAccount)
    return (
      <Panel>
        <h3>Профиль</h3>
        <p>
          Готовые демосценарии используют фиксированные учебные аккаунты. Для
          проверки профиля и пароля создайте тестовый аккаунт через регистрацию.
        </p>
      </Panel>
    );
  return (
    <>
      <Panel>
        <h3>Профиль</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setSession(identity.updateProfile(session, name));
              setSuccess(true);
              setError(null);
            } catch (e) {
              setError(e as Error);
            }
          }}
        >
          <TextInput
            label="Имя"
            value={name}
            required
            maxLength={100}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Email"
            value={session.email || ""}
            readOnly
            description="Изменение email требует отдельного подтверждения и сейчас недоступно"
          />
          <Button type="submit" variant="default">
            Сохранить профиль
          </Button>
          {success && <p role="status">Профиль сохранён</p>}
        </form>
      </Panel>
      <Panel>
        <h3>Смена пароля</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            try {
              if (password !== confirm) throw new Error("Пароли не совпадают");
              await identity.changePassword(session, old, password);
              setSession(null);
            } catch (e) {
              setError(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <PasswordInput
            label="Текущий пароль"
            required
            value={old}
            onChange={(e) => setOld(e.currentTarget.value)}
            autoComplete="current-password"
          />
          <PasswordInput
            label="Новый пароль"
            description="От 10 символов, буквы и цифры"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <PasswordInput
            label="Повторите новый пароль"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            autoComplete="new-password"
          />
          <p>
            После изменения потребуется повторный вход. Старые локальные сеансы
            будут отозваны.
          </p>
          <Button type="submit" loading={busy}>
            Изменить пароль
          </Button>
        </form>
      </Panel>
      <ErrorMessage error={error} />
    </>
  );
}
