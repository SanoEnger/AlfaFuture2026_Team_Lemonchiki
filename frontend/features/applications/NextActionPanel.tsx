import { Button } from "@mantine/core";
import { Link } from "react-router-dom";
import type { Application } from "../../shared/api/types";
import { date } from "../../shared/format";
import { Panel, StatusBadge } from "../../components/ui/common";
import { deriveNextAction } from "./deriveNextAction";
export function NextActionPanel({ application }: { application: Application }) {
  const next = deriveNextAction(application);
  const event = application.events.at(-1);
  return (
    <Panel className="next-step next-action-panel">
      <span className="eyebrow">СЛЕДУЮЩЕЕ ДЕЙСТВИЕ</span>
      <h3>{next.title}</h3>
      <StatusBadge status={application.status} />
      <p className="next-action-description">{next.description}</p>
      {application.status === "COMPLETED" && (
        <p className="success-text">Оформление завершено</p>
      )}
      {next.action && (
        <Button component={Link} to={next.action.to} variant="default">
          {next.action.label}
        </Button>
      )}
      {event && (
        <>
          <hr />
          <small className="muted">
            Последнее событие · {date(event.occurred_at)}
          </small>
          <p className="event-preview">{event.reason}</p>
        </>
      )}
    </Panel>
  );
}
