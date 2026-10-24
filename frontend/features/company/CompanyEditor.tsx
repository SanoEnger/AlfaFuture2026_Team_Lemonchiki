import { useState } from "react";
import { Button, NumberInput, Select, TextInput } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "../../app/session";
import { data as demo } from "../../shared/api/data";
import type { Company } from "../../shared/api/types";
import { ErrorMessage, Panel, PageTitle } from "../../components/ui/common";
import { minorUnits } from "../../shared/validation";
export function CompanyEditor({
  initial,
  onSaved,
}: {
  initial?: Company;
  onSaved?: () => void;
}) {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [value, setValue] = useState<Company>(
    initial || {
      id: crypto.randomUUID(),
      legal_name: "",
      inn: "",
      form: "ООО",
      industry: "TRADE",
      revenue: "0",
      expenses: "0",
      debt_payment: "0",
      months_active: 0,
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  function change<K extends keyof Company>(key: K, v: Company[K]) {
    setValue((c) => ({ ...c, [key]: v }));
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
          if (!/^(?:\d{10}|\d{12})$/.test(value.inn))
            throw new Error("ИНН должен содержать 10 или 12 цифр");
          if (
            [value.revenue, value.expenses, value.debt_payment].some(
              (v) => minorUnits(v) === null,
            )
          )
            throw new Error("Проверьте финансовые показатели");
          await demo.updateCompany(session!.username, value);
          await qc.invalidateQueries();
          if (!initial) {
            setSession({ ...session!, onboardingComplete: true });
            navigate("/client/dashboard", { replace: true });
          } else onSaved?.();
        } catch (e) {
          setError(e as Error);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted">
        Только синтетические данные. ИНН проверяется по формату, реестровая
        проверка не выполняется. Изменения профиля не переписывают сведения
        отправленных заявок.
      </p>
      <div className="form-grid">
        <TextInput
          label="Юридическое название"
          required
          maxLength={255}
          value={value.legal_name}
          onChange={(e) => change("legal_name", e.currentTarget.value)}
        />
        <TextInput
          label="ИНН"
          required
          inputMode="numeric"
          maxLength={12}
          value={value.inn}
          error={
            value.inn && !/^(?:\d{10}|\d{12})$/.test(value.inn)
              ? "10 или 12 цифр"
              : undefined
          }
          onChange={(e) => change("inn", e.currentTarget.value)}
        />
        <Select
          label="Форма"
          value={value.form}
          data={["ООО", "ИП"]}
          onChange={(v) => change("form", v || "ООО")}
        />
        <Select
          label="Отрасль"
          value={value.industry}
          data={[
            { value: "TRADE", label: "Торговля" },
            { value: "SERVICES", label: "Услуги" },
            { value: "PRODUCTION", label: "Производство" },
          ]}
          onChange={(v) => change("industry", v || "TRADE")}
        />
        {(
          [
            ["revenue", "Среднемесячная выручка, ₽"],
            ["expenses", "Среднемесячные расходы, ₽"],
            ["debt_payment", "Платежи по долгам, ₽"],
          ] as const
        ).map(([key, label]) => (
          <NumberInput
            key={key}
            label={label}
            required
            min={0}
            decimalScale={2}
            thousandSeparator=" "
            value={value[key]}
            onChange={(v) => change(key, String(v))}
          />
        ))}
        <NumberInput
          label="Возраст бизнеса, месяцев"
          min={0}
          max={1200}
          allowDecimal={false}
          value={value.months_active}
          onChange={(v) => change("months_active", Number(v))}
        />
      </div>
      <ErrorMessage error={error} />
      <Button type="submit" loading={busy}>
        {initial ? "Сохранить изменения" : "Завершить настройку"}
      </Button>
    </form>
  );
}
export function Onboarding() {
  return (
    <>
      <PageTitle
        title="Настройка компании"
        subtitle="Укажите сведения, чтобы перейти к кредитным продуктам"
      />
      <Panel>
        <CompanyEditor />
      </Panel>
    </>
  );
}
