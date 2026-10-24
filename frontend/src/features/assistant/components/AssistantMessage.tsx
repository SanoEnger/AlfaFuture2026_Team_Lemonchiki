import { ArrowUpRight, BookOpen, MessagesSquare } from "lucide-react";
import { Link } from "react-router-dom";
import type { AssistantMessage as Message } from "../types";

export function AssistantMessage({
  message,
  onRetry,
  onNavigate,
}: {
  message: Message;
  onRetry: () => void;
  onNavigate: () => void;
}) {
  if (message.role === "user")
    return (
      <div className="credit-ai__message credit-ai__message--user">
        <span className="sr-only">Вы: </span>
        {message.text}
      </div>
    );
  return (
    <article
      className="credit-ai__message credit-ai__message--assistant"
      aria-label="Ответ помощника"
    >
      <div className="credit-ai__author">
        <span className="credit-ai__author-mark" aria-hidden="true">
          <MessagesSquare />
        </span>
        <span className="credit-ai__author-name">Помощник · локальный FAQ</span>
      </div>
      {message.status === "pending" ? (
        <div className="credit-ai__loading">
          Подготовка справки по локальным данным…
        </div>
      ) : message.status === "error" ? (
        <div className="credit-ai__error">
          <p>{message.text}</p>
          <button className="credit-ai__retry" type="button" onClick={onRetry}>
            Повторить запрос
          </button>
        </div>
      ) : (
        <>
          <div className="credit-ai__response">
            {message.text.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {message.sources.length > 0 && (
            <div className="credit-ai__source">
              <BookOpen aria-hidden="true" />
              <div>
                <span>Источник: </span>
                {message.sources.map((source, i) => (
                  <span key={source.to}>
                    {i > 0 && "; "}
                    <Link
                      className="credit-ai__source-link"
                      to={source.to}
                      onClick={onNavigate}
                    >
                      {source.label}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          )}
          {message.actions.length > 0 && (
            <div className="credit-ai__actions">
              {message.actions.map((action) => (
                <Link
                  key={action.to}
                  className="credit-ai__action"
                  to={action.to}
                  onClick={onNavigate}
                >
                  {action.label}
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}
