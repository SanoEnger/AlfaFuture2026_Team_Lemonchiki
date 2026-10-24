import type { Application } from "../../shared/api/types";
import { money } from "../../shared/format";
export function OfferComparison({
  application: a,
}: {
  application: Application;
}) {
  const o = a.latest_offer;
  if (!o) return <p>Предложение пока не подготовлено.</p>;
  return (
    <div className="table-scroll">
      <table className="offer-table">
        <caption className="sr-only">
          Сравнение запрошенных и предложенных условий.
        </caption>
        <thead>
          <tr>
            <th scope="col">Параметр</th>
            <th scope="col">Запрошено</th>
            <th scope="col">Предложено банком</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Сумма</th>
            <td>{money(a.requested_terms.amount)}</td>
            <td
              className={
                Number(o.amount) !== Number(a.requested_terms.amount)
                  ? "offer-changed"
                  : ""
              }
            >
              {money(o.amount)}
              {Number(o.amount) !== Number(a.requested_terms.amount) && (
                <small>Изменено</small>
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Срок</th>
            <td>{a.requested_terms.term_months} мес.</td>
            <td
              className={
                o.term_months !== a.requested_terms.term_months
                  ? "offer-changed"
                  : ""
              }
            >
              {o.term_months} мес.
              {o.term_months !== a.requested_terms.term_months && (
                <small>Изменено</small>
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Годовая ставка</th>
            <td>Не запрашивалась</td>
            <td>{o.annual_rate}% годовых</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
