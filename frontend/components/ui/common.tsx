import type { ReactNode } from "react";
import { Alert, Button, Loader } from "@mantine/core";
import { AlertCircle, Inbox } from "lucide-react";
import type { Status } from "../../shared/api/types";
import { statuses } from "../../shared/format";
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {statuses[status]}
    </span>
  );
}
export function Empty({
  title = "Пока ничего нет",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function QueryState({
  query,
  children,
}: {
  query: { isPending: boolean; error: Error | null; refetch: () => unknown };
  children: ReactNode;
}) {
  if (query.isPending)
    return (
      <div className="loading" role="status">
        <Loader size="sm" />
        <span>Загружаем данные…</span>
      </div>
    );
  if (query.error)
    return (
      <Alert
        color="red"
        title="Не удалось загрузить данные"
        icon={<AlertCircle size={18} />}
      >
        <p>{query.error.message}</p>
        <Button variant="light" onClick={() => query.refetch()}>
          Повторить
        </Button>
      </Alert>
    );
  return <>{children}</>;
}
export function ErrorMessage({ error }: { error: Error | null }) {
  return error ? (
    <Alert color="red" role="alert" icon={<AlertCircle size={18} />}>
      {error.message}
    </Alert>
  ) : null;
}
export function Metrics({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="metrics">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
