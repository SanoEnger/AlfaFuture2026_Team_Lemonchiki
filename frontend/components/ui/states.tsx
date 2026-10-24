import type { ReactNode } from "react";
import { Alert, Button, Skeleton } from "@mantine/core";
import { ApiError } from "../../shared/api/errors";
export function LoadingState() {
  return (
    <div
      className="loading state-skeleton"
      role="status"
      aria-label="Загружаем данные"
    >
      <Skeleton height={24} width="55%" />
      <Skeleton height={16} width="80%" />
      <Skeleton height={84} />
      <span className="sr-only">Загружаем данные…</span>
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function PermissionDeniedState() {
  return (
    <Alert color="yellow" title="Доступ ограничен">
      У текущей роли нет прав для этого действия.
    </Alert>
  );
}
export function NotFoundState() {
  return (
    <Alert color="gray" title="Заявка не найдена">
      Запись недоступна или принадлежит другому пользователю.
    </Alert>
  );
}
export function DisabledReason({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}
export function SuccessFeedback({ children }: { children: ReactNode }) {
  return (
    <p className="success-text" role="status">
      {children}
    </p>
  );
}
export function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => unknown;
}) {
  if (error instanceof ApiError && error.status === 403)
    return <PermissionDeniedState />;
  if (error instanceof ApiError && error.status === 404)
    return <NotFoundState />;
  const title =
    error instanceof ApiError
      ? {
          401: "Сеанс недоступен",
          409: "Данные заявки изменились",
          422: "Проверьте введённые данные",
        }[error.status] || "Не удалось выполнить действие"
      : "Не удалось загрузить данные";
  return (
    <Alert color="red" title={title} role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <Button variant="light" onClick={onRetry}>
          {error instanceof ApiError && error.status === 409
            ? "Обновить данные"
            : "Повторить"}
        </Button>
      )}
    </Alert>
  );
}
