import { useState } from "react";
import { Button, Modal } from "@mantine/core";
import { ArrowUpRight, Landmark, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { demo } from "../../shared/api/demo";
import type { Product } from "../../shared/api/types";
import { money } from "../../shared/format";
import {
  PageTitle,
  Panel,
  QueryState,
  Metrics,
} from "../../components/ui/common";
export function ProductCards({ compact = false }: { compact?: boolean }) {
  const q = useQuery({ queryKey: ["products"], queryFn: demo.products });
  const [selected, setSelected] = useState<Product | null>(null);
  return (
    <QueryState query={q}>
      <div className="product-grid">
        {q.data?.map((p, i) => (
          <Panel key={p.id} className="product-card">
            <div className="product-heading">
              <div className="product-icon">
                {i === 0 ? <ArrowUpRight size={25} /> : <Landmark size={25} />}
              </div>
              <div>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
              </div>
            </div>
            {!compact && (
              <>
                <Metrics
                  items={[
                    [`От ${p.annual_rate}% годовых`, money(p.max_amount)],
                    ["Срок", `до ${p.max_term} мес.`],
                  ]}
                />
                <p className="muted">
                  Демонстрационные условия · Без реальной выдачи
                </p>
              </>
            )}
            <div className="product-bottom">
              <button className="text-button" onClick={() => setSelected(p)}>
                Подробнее об условиях <ArrowRight size={14} />
              </button>
              {!compact && (
                <Button
                  component={Link}
                  to={`/client/applications/new?product=${p.id}`}
                  variant="light"
                >
                  Выбрать
                </Button>
              )}
            </div>
          </Panel>
        ))}
      </div>
      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title="Условия продукта"
        centered
      >
        {selected && (
          <>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <dl className="details-list">
              <div>
                <dt>Сумма</dt>
                <dd>
                  {money(selected.min_amount)} — {money(selected.max_amount)}
                </dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>
                  {selected.min_term}–{selected.max_term} мес.
                </dd>
              </div>
              <div>
                <dt>Демо-ставка</dt>
                <dd>{selected.annual_rate}% годовых</dd>
              </div>
            </dl>
            <p className="muted">
              Синтетический продукт для демонстрации интерфейса.
            </p>
            <Button
              component={Link}
              to={`/client/applications/new?product=${selected.id}`}
            >
              Создать заявку
            </Button>
          </>
        )}
      </Modal>
    </QueryState>
  );
}
export function Products() {
  return (
    <>
      <PageTitle
        title="Кредитные продукты"
        subtitle="Финансирование под задачи вашего бизнеса"
      />
      <ProductCards />
    </>
  );
}
