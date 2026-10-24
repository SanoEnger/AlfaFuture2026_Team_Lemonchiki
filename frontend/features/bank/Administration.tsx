import { useState } from "react";
import { Button, Modal, TextInput } from "@mantine/core";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { identity } from "../../shared/api/identity";
import { useSession } from "../../app/session";
import { date } from "../../shared/format";
import {
  Empty,
  ErrorMessage,
  PageTitle,
  Panel,
  QueryState,
} from "../../components/ui/common";
import { PermissionDeniedState } from "../../components/ui/states";
export function Administration() {
  const { session } = useSession();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const view = pathname.endsWith("/invitations")
    ? "invitations"
    : pathname.endsWith("/audit")
      ? "audit"
      : "staff";
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirm, setConfirm] = useState<{
    id: string;
    type: "suspend" | "reactivate" | "revoke";
    name: string;
  } | null>(null);
  const q = useQuery({
    queryKey: ["administration", session?.username],
    queryFn: async () => {
      const [staff, invitations, audit] = await Promise.all([
        identity.staff(),
        identity.invitations(),
        identity.audit(),
      ]);
      return { staff, invitations, audit };
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (confirm) {
        if (confirm.type === "revoke")
          await identity.revoke(session!, confirm.id);
        else
          await identity.suspend(
            session!,
            confirm.id,
            confirm.type === "suspend",
          );
      } else await identity.invite(session!, email);
    },
    onSuccess: async () => {
      setFeedback(confirm ? "Изменение сохранено" : "Приглашение отправлено");
      setConfirm(null);
      setInvite(false);
      setEmail("");
      await qc.invalidateQueries();
    },
  });
  if (session?.role !== "BANK_ADMIN") return <PermissionDeniedState />;
  const staff =
    q.data?.staff.filter((u) =>
      `${u.displayName} ${u.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <PageTitle
        title="Администрирование"
        subtitle="Сотрудники, приглашения и журнал действий"
        action={
          <Button
            onClick={() => {
              mutation.reset();
              setInvite(true);
            }}
          >
            Пригласить сотрудника
          </Button>
        }
      />
      <nav className="admin-tabs" aria-label="Администрирование">
        <Link
          aria-current={view === "staff" ? "page" : undefined}
          to="/bank/administration/staff"
        >
          Сотрудники
        </Link>
        <Link
          aria-current={view === "invitations" ? "page" : undefined}
          to="/bank/administration/invitations"
        >
          Приглашения
        </Link>
        <Link
          aria-current={view === "audit" ? "page" : undefined}
          to="/bank/administration/audit"
        >
          Аудит
        </Link>
      </nav>
      <p className="muted">
        Управление доступом. Администратор не принимает кредитные решения.
        Блокировка отзывает действующие сеансы; назначения сохраняются для
        переназначения.
      </p>
      {feedback && (
        <p className="success-text" role="status">
          {feedback}
        </p>
      )}
      <QueryState query={q}>
        <Panel>
          {view === "staff" ? (
            <>
              <TextInput
                label="Поиск сотрудников"
                placeholder="Имя или email"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
              {staff.length ? (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Сотрудник</th>
                        <th>Роль / состояние</th>
                        <th>Активация / вход</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((u) => (
                        <tr key={u.id}>
                          <td>
                            {u.displayName}
                            <small>{u.email}</small>
                          </td>
                          <td>
                            {u.role === "BANK_ADMIN"
                              ? "Администратор"
                              : "Сотрудник банка"}
                            <small>
                              {u.status === "ACTIVE"
                                ? "Активен"
                                : "Заблокирован"}
                            </small>
                          </td>
                          <td>
                            {date(u.createdAt)}
                            <small>
                              {u.lastLogin
                                ? date(u.lastLogin)
                                : "Входов ещё нет"}
                            </small>
                          </td>
                          <td>
                            <Button
                              variant="default"
                              disabled={u.role === "BANK_ADMIN"}
                              onClick={() => {
                                mutation.reset();
                                setConfirm({
                                  id: u.id,
                                  type:
                                    u.status === "ACTIVE"
                                      ? "suspend"
                                      : "reactivate",
                                  name: u.displayName,
                                });
                              }}
                            >
                              {u.status === "ACTIVE"
                                ? "Заблокировать"
                                : "Восстановить"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="Сотрудники не найдены">
                  <p>Пригласите сотрудника или измените поиск.</p>
                </Empty>
              )}
            </>
          ) : view === "invitations" ? (
            <>
              {q.data?.invitations.length ? (
                q.data.invitations.map((i) => (
                  <div className="admin-record" key={i.id}>
                    <div>
                      <strong>{i.email}</strong>
                      <p>
                        {i.status === "USED"
                          ? "Использовано"
                          : i.status === "REVOKED"
                            ? "Отозвано"
                            : i.expiresAt < new Date().toISOString()
                              ? "Истекло"
                              : "Ожидает активации"}{" "}
                        · до {date(i.expiresAt)}
                      </p>
                    </div>
                    {i.status === "PENDING" && (
                      <Button
                        variant="default"
                        onClick={() => {
                          mutation.reset();
                          setConfirm({
                            id: i.id,
                            type: "revoke",
                            name: i.email,
                          });
                        }}
                      >
                        Отозвать
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <Empty title="Приглашений пока нет" />
              )}
            </>
          ) : (
            <>
              {q.data?.audit.length ? (
                q.data.audit.map((e) => (
                  <div className="admin-record" key={e.id}>
                    <div>
                      <strong>{e.action}</strong>
                      <p>
                        Актёр: {identity.user(e.actor)?.displayName || e.actor}{" "}
                        · объект: {e.object}
                      </p>
                      <small>{date(e.createdAt)}</small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="Действий пока нет" />
              )}
            </>
          )}
        </Panel>
      </QueryState>
      <Modal
        opened={invite || !!confirm}
        onClose={() => {
          if (!mutation.isPending) {
            setInvite(false);
            setConfirm(null);
          }
        }}
        title={
          confirm ? "Подтвердите изменение доступа" : "Пригласить сотрудника"
        }
        centered
      >
        {confirm ? (
          <p>
            {confirm.type === "suspend"
              ? "Заблокировать доступ и отозвать сеансы"
              : confirm.type === "reactivate"
                ? "Восстановить доступ без возврата старых сеансов"
                : "Отозвать приглашение"}
            : {confirm.name}?
          </p>
        ) : (
          <>
            <TextInput
              label="Email сотрудника"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <p>
              Роль: BANK_OFFICER. Клиентский аккаунт не преобразуется в
              банковский. Приглашение действует 48 часов.
            </p>
          </>
        )}
        <ErrorMessage error={mutation.error} />
        <Button
          loading={mutation.isPending}
          disabled={!confirm && !email.trim()}
          onClick={() => mutation.mutate()}
        >
          {confirm ? "Подтвердить" : "Создать приглашение"}
        </Button>
      </Modal>
    </>
  );
}
