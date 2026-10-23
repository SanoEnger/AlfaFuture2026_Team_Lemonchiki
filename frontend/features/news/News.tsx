import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, SegmentedControl } from "@mantine/core";
import { ArrowUpRight } from "lucide-react";
import { useSession } from "../../app/session";
import { demo } from "../../shared/api/demo";
import type { News as NewsItem } from "../../shared/api/types";
import { date } from "../../shared/format";
import { PageTitle, Panel, QueryState } from "../../components/ui/common";
export function NewsCards({ compact = false }: { compact?: boolean }) {
  const { session } = useSession();
  const q = useQuery({
    queryKey: ["news", session?.username],
    queryFn: () => demo.news(session!.username),
  });
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [filter, setFilter] = useState("Все");
  const items = q.data?.filter(
    (n) => filter === "Все" || n.category === filter,
  );
  return (
    <QueryState query={q}>
      {!compact && (
        <SegmentedControl
          className="news-filter"
          value={filter}
          onChange={setFilter}
          data={["Все", ...new Set(q.data?.map((n) => n.category))]}
        />
      )}
      <div className="news-grid">
        {items?.slice(0, compact ? 2 : undefined).map((n) => (
          <Panel className="news-card" key={n.id}>
            <div className="row between">
              <span className="eyebrow">{n.category}</span>
              <small className="muted">{date(n.date)}</small>
            </div>
            <h3>
              <button onClick={() => setSelected(n)}>{n.title}</button>
            </h3>
            <p>{n.body.split("\n")[0].slice(0, 130)}…</p>
            <button className="text-button" onClick={() => setSelected(n)}>
              Читать материал <ArrowUpRight size={15} />
            </button>
          </Panel>
        ))}
      </div>
      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title="Демо-материал"
        size="lg"
        centered
      >
        {selected && (
          <article>
            <span className="eyebrow">
              {selected.category} · {date(selected.date)}
            </span>
            <h2>{selected.title}</h2>
            {selected.body.split("\n\n").map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="muted">
              Синтетический материал для демонстрации персональной ленты.
            </p>
          </article>
        )}
      </Modal>
    </QueryState>
  );
}
export function News() {
  return (
    <>
      <PageTitle
        title="Новости для вашего бизнеса"
        subtitle="Персональная подборка по отрасли и задачам компании"
      />
      <div className="notice">
        Демо-контент · Все публикации созданы для демонстрации
      </div>
      <NewsCards />
    </>
  );
}
