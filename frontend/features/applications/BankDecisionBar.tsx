import { Button, Select } from "@mantine/core";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../../app/session";
import { canDecide } from "../../shared/api/demo";
import { data as demo } from "../../shared/api/data";
import { identity } from "../../shared/api/identity";
import { ErrorMessage } from "../../components/ui/common";
import type { Application } from "../../shared/api/types";
import { Panel } from "../../components/ui/common";
export function BankDecisionBar({
  application,
  onAction,
}: {
  application: Application;
  onAction: (action: "offer" | "info" | "reject") => void;
}) {
  const { session } = useSession();
  const qc = useQueryClient();
  const [officer, setOfficer] = useState<string | null>(null);
  const enabled =
    application.status === "UNDER_REVIEW" &&
    !!session &&
    (session.mode === "api"
      ? session.role === "BANK_EMPLOYEE"
      : canDecide(application, session));
  const admin = session?.role === "BANK_ADMIN";
  const mutation = useMutation({
    mutationFn: () =>
      admin
        ? demo.assign(
            application.id,
            session!,
            officer!,
            application.version || 1,
          )
        : demo.claim(application.id, session!, application.version || 1),
    onSuccess: () => qc.invalidateQueries(),
    onError: () => qc.invalidateQueries(),
  });
  const assigned = application.assigned_officer_id;
  return (
    <Panel className="bank-decision-bar">
      <h3>Работа с заявкой</h3>
      <p>
        <strong>Ответственный: </strong>
        {session?.mode === "api"
          ? "Назначение в этом API не предусмотрено"
          : assigned
            ? identity.user(assigned)?.displayName ||
              (assigned === "banker"
                ? "Сотрудник банка"
                : assigned === "banker_two"
                  ? "Второй сотрудник банка"
                  : assigned)
            : "Не назначен"}
      </p>
      {!admin &&
        session?.mode !== "api" &&
        !assigned &&
        application.status === "UNDER_REVIEW" && (
          <Button
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Взять в работу
          </Button>
        )}
      {admin && (
        <>
          <Select
            label="Новый ответственный"
            value={officer}
            onChange={setOfficer}
            data={[
              { value: "banker", label: "Сотрудник банка · демо" },
              { value: "banker_two", label: "Второй сотрудник · демо" },
              ...identity
                .staff()
                .filter((u) => u.status === "ACTIVE")
                .map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
          <Button
            variant="default"
            disabled={!officer || officer === assigned}
            loading={mutation.isPending}
            onClick={() => {
              if (window.confirm("Подтвердить переназначение заявки?"))
                mutation.mutate();
            }}
          >
            Переназначить
          </Button>
          <p className="muted">Кредитные решения недоступны администратору.</p>
        </>
      )}
      <ErrorMessage error={mutation.error} />
      <p>
        {enabled
          ? "Проверьте данные и факторы риска перед решением."
          : application.next_action}
      </p>
      {!admin && (
        <div className="bank-actions">
          <Button disabled={!enabled} onClick={() => onAction("offer")}>
            Предложить условия
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
      )}
      {!enabled && (
        <p className="muted">
          Решение доступно назначенному сотруднику при статусе «На
          рассмотрении».
        </p>
      )}
      <small className="muted">
        Демо-режим · допустимость операции повторно проверяет локальный адаптер.
      </small>
    </Panel>
  );
}
