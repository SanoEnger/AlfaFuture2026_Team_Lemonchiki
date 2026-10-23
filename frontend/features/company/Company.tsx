import { useQuery } from "@tanstack/react-query";
import { Building2, BadgeCheck } from "lucide-react";
import { useSession } from "../../app/session";
import { demo } from "../../shared/api/demo";
import { industryName, money } from "../../shared/format";
import {
  PageTitle,
  Panel,
  QueryState,
  Metrics,
} from "../../components/ui/common";
import type { Company as CompanyData } from "../../shared/api/types";
export function CompanyInfo({ company: c }: { company: CompanyData }) {
  return (
    <>
      <Panel>
        <div className="company-heading">
          <div className="product-icon">
            <Building2 size={25} />
          </div>
          <div>
            <h2>{c.legal_name}</h2>
            <p>ИНН {c.inn}</p>
          </div>
          <span className="status status-COMPLETED">
            <BadgeCheck size={14} />
            Демо-компания
          </span>
        </div>
        <hr />
        <h3>Реквизиты компании</h3>
        <dl className="details-list">
          <div>
            <dt>Полное наименование</dt>
            <dd>{c.legal_name}</dd>
          </div>
          <div>
            <dt>Организационная форма</dt>
            <dd>{c.form}</dd>
          </div>
          <div>
            <dt>ИНН</dt>
            <dd>{c.inn}</dd>
          </div>
          <div>
            <dt>Отрасль</dt>
            <dd>{industryName(c.industry)}</dd>
          </div>
          <div>
            <dt>Возраст бизнеса</dt>
            <dd>{c.months_active} мес.</dd>
          </div>
        </dl>
      </Panel>
      <Panel>
        <h3>Финансовые показатели</h3>
        <p>Среднемесячные значения</p>
        <Metrics
          items={[
            ["Выручка", money(c.revenue)],
            ["Расходы", money(c.expenses)],
            ["Долговые платежи", money(c.debt_payment)],
          ]}
        />
        <hr />
        <p className="muted">
          Данные можно уточнить при создании заявки. В прототипе используются
          только синтетические сведения.
        </p>
      </Panel>
    </>
  );
}
export function Company() {
  const { session } = useSession();
  const q = useQuery({
    queryKey: ["company", session?.username],
    queryFn: () => demo.company(session!.username),
  });
  return (
    <>
      <PageTitle
        title="Моя компания"
        subtitle="Реквизиты и финансовые показатели бизнеса"
      />
      <QueryState query={q}>
        <div className="stack">
          {q.data && <CompanyInfo company={q.data} />}
        </div>
      </QueryState>
    </>
  );
}
