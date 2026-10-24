import { Maximize2, Minimize2, MessagesSquare, X } from "lucide-react";
import { Drawer } from "@mantine/core";
export function AssistantHeader({
  expanded,
  canExpand,
  onExpand,
  onClose,
}: {
  expanded: boolean;
  canExpand: boolean;
  onExpand: () => void;
  onClose: () => void;
}) {
  return (
    <header className="credit-ai__header">
      <span className="credit-ai__mark" aria-hidden="true">
        <MessagesSquare />
      </span>
      <div className="credit-ai__identity">
        <Drawer.Title className="credit-ai__title">Помощник</Drawer.Title>
        <p className="credit-ai__subtitle">По кредитным вопросам</p>
      </div>

      <div className="credit-ai__header-actions">
        {canExpand && (
          <button
            className="credit-ai__icon-button"
            type="button"
            aria-label={expanded ? "Сузить панель" : "Расширить панель"}
            aria-pressed={expanded}
            onClick={onExpand}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </button>
        )}
        <button
          className="credit-ai__icon-button"
          type="button"
          aria-label="Закрыть помощника"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
    </header>
  );
}
