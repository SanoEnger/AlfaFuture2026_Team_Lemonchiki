import { useState } from "react";
import { Button, Select, Modal } from "@mantine/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../../app/session";
import { data } from "../../shared/api/data";
import { identity } from "../../shared/api/identity";
import { Panel, ErrorMessage } from "../../components/ui/common";
import type { Application } from "../../shared/api/types";
export function BankDecisionBar({
  application: a,
  onAction,
}: {
  application: Application;
  onAction: (action: "approve" | "offer" | "info" | "reject") => void;
}) {
  const { session } = useSession();
  const qc = useQueryClient();
  const [officer, setOfficer] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const admin = session?.role === "BANK_ADMIN";
  const enabled =
    a.status === "UNDER_REVIEW" &&
    !admin &&
    a.assigned_officer_id === session?.username;
  const directory = useQuery({
    queryKey: ["officers", session?.username],
    queryFn: identity.officers,
  });
  const m = useMutation({
    mutationFn: () =>
      admin
        ? data.assign(a.id, session!, officer!, a.version)
        : data.claim(a.id, session!, a.version),
    onSuccess: async () => {
      setConfirm(false);
      await qc.invalidateQueries();
    },
    onError: () => qc.invalidateQueries(),
  });
  const assigned =
    a.assigned_officer_name ||
    directory.data?.find((u) => u.id === a.assigned_officer_id)?.displayName;
  return (
    <Panel className="bank-decision-bar">
      <h3>Работа с заявкой</h3>
      <p>
        <strong>Ответственный: </strong>
        {assigned || "Не назначен"}
      </p>
      {!admin && !a.assigned_officer_id && a.status === "UNDER_REVIEW" && (
        <Button loading={m.isPending} onClick={() => m.mutate()}>
          Взять в работу
        </Button>
      )}
      {admin ? (
        <>
          <Select
            label="Новый ответственный"
            value={officer}
            onChange={setOfficer}
            data={(directory.data || [])
              .filter((u) => u.status === "ACTIVE")
              .map((u) => ({ value: u.id, label: u.displayName }))}
          />
          <Button
            variant="default"
            disabled={!officer || officer === a.assigned_officer_id}
            onClick={() => setConfirm(true)}
          >
            Переназначить
          </Button>
          <p className="muted">
            Администратор управляет назначениями. Кредитное решение принимает
            сотрудник банка.
          </p>
        </>
      ) : (
        <>
          <p>
            {enabled
              ? "Проверьте сведения и факторы риска перед решением."
              : a.next_action}
          </p>
          <div className="bank-actions">
            <Button disabled={!enabled} onClick={() => onAction("approve")}>
              Одобрить на условиях клиента
            </Button>
            <Button variant="default" disabled={!enabled} onClick={() => onAction("offer")}>
              Предложить другие условия
            </Button>
            <Button
              variant="default"
              disabled={!enabled}
              onClick={() => onAction("info")}
            >
              Запросить сведения
            </Button>
            <Button
              variant="subtle"
              disabled={!enabled}
              onClick={() => onAction("reject")}
            >
              Отказать
            </Button>
          </div>
          {!enabled && (
            <p className="muted">
              Решение доступно назначенному сотруднику при статусе «На
              рассмотрении».
            </p>
          )}
        </>
      )}
      <ErrorMessage error={m.error || directory.error} />
      <Modal
        opened={confirm}
        onClose={() => {
          if (!m.isPending) setConfirm(false);
        }}
        title="Изменить ответственного?"
        centered
      >
        <p>Назначение и прежний ответственный сохранятся в истории.</p>
        <ErrorMessage error={m.error} />
        <Button loading={m.isPending} onClick={() => m.mutate()}>
          Подтвердить назначение
        </Button>
      </Modal>
    </Panel>
  );
}
