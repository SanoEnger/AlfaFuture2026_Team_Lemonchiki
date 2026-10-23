import { useState } from "react";
import { Button, Select } from "@mantine/core";
import { Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { useSession } from "./session";
export function Login() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState("client_good");
  if (session)
    return (
      <Navigate
        to={
          session.role === "CLIENT" ? "/client/dashboard" : "/bank/applications"
        }
        replace
      />
    );
  return (
    <main className="login">
      <div className="login-intro">
        <div className="brand">
          <b>а</b>
          <div>
            альфа<small>БИЗНЕС · ДЕМО</small>
          </div>
        </div>
        <div>
          <span className="eyebrow">SMART CREDIT</span>
          <h1>
            Бизнес растёт.
            <br />
            Возможности — тоже.
          </h1>
          <p>
            Кредитный кабинет предпринимателя.
            <br />
            От заявки до решения — в одном месте.
          </p>
        </div>
        <span className="muted">Учебный проект · Синтетические данные</span>
      </div>
      <section className="login-form panel">
        <ShieldCheck className="accent" size={30} />
        <h2>Вход в кабинет</h2>
        <p>Выберите демонстрационную роль</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const role = username === "banker" ? "BANK_EMPLOYEE" : "CLIENT";
            setSession({ username, role });
            navigate(
              role === "CLIENT" ? "/client/dashboard" : "/bank/applications",
            );
          }}
        >
          <Select
            label="Демо-сценарий"
            value={username}
            onChange={(v) => setUsername(v || "client_good")}
            data={[
              { value: "client_good", label: "Предприниматель · ООО «Вектор»" },
              { value: "client_risky", label: "Предприниматель · ИП Сервис" },
              { value: "banker", label: "Сотрудник банка" },
            ]}
          />
          <Button
            type="submit"
            fullWidth
            rightSection={<ArrowRight size={16} />}
          >
            Войти в кабинет
          </Button>
        </form>
        <small className="muted">
          Локальная демонстрация интерфейса. Данные сохраняются только в этом
          браузере, подключение к серверу не требуется.
        </small>
      </section>
    </main>
  );
}
