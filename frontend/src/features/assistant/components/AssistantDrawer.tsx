import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Drawer } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { AssistantHeader } from "./AssistantHeader";
import { AssistantContext } from "./AssistantContext";
import { AssistantQuickQuestions } from "./AssistantQuickQuestions";
import { AssistantMessage } from "./AssistantMessage";
import { AssistantComposer } from "./AssistantComposer";
import { useAssistantContext } from "../hooks/useAssistantContext";
import { useAssistantChat } from "../hooks/useAssistantChat";
import { quickQuestions } from "../assistantContent";

export function AssistantDrawer({
  opened,
  onClose,
  expanded,
  onExpandedChange,
}: {
  opened: boolean;
  onClose: () => void;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
}) {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const mobile = useMediaQuery("(max-width: 768px)");
  const canExpand = useMediaQuery("(min-width: 1440px)");
  const { context, isLoading, error, refresh } = useAssistantContext(opened);
  const chat = useAssistantChat(context);
  const messages = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({
    height: window.innerHeight,
    top: 0,
  });
  useEffect(() => {
    if (!opened || !mobile) return;
    const update = () =>
      setViewport({
        height: window.visualViewport?.height || window.innerHeight,
        top: window.visualViewport?.offsetTop || 0,
      });
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [opened, mobile]);
  useLayoutEffect(() => {
    const el = messages.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, context.contextKey, opened]);
  const selected = [...chat.messages]
    .reverse()
    .find((m) => m.role === "user")?.text;
  return (
    <Drawer.Root
      opened={opened}
      onClose={onClose}
      position="right"
      size={mobile ? "100%" : expanded && canExpand ? 580 : 420}
      lockScroll={!desktop}
      trapFocus
      returnFocus
      closeOnEscape
      className="credit-assistant"
      classNames={{ content: "credit-ai", body: "credit-ai__drawer-body" }}
      styles={
        mobile
          ? {
              inner: {
                height: viewport.height,
                top: viewport.top,
                bottom: "auto",
              },
              content: { height: viewport.height },
            }
          : undefined
      }
    >
      {!desktop && <Drawer.Overlay />}
      <Drawer.Content>
        <Drawer.Body>
          <div
            className="credit-ai__shell"
            data-compact={mobile && viewport.height < 570}
          >
            <AssistantHeader
              expanded={expanded && !!canExpand}
              canExpand={!!canExpand}
              onExpand={() => onExpandedChange(!expanded)}
              onClose={onClose}
            />
            <AssistantContext
              context={context}
              loading={isLoading}
              error={error}
              onRefresh={refresh}
            />
            <AssistantQuickQuestions
              questions={quickQuestions(context)}
              selected={selected}
              busy={chat.busy || isLoading || !!error}
              onQuestion={chat.send}
            />
            <div
              ref={messages}
              className="credit-ai__messages"
              role="region"
              aria-label="Диалог с помощником"
              tabIndex={0}
            >
              {chat.messages.length === 0 ? (
                <div className="credit-ai__empty">
                  <h3 className="credit-ai__empty-title">
                    Разберёмся в кредитном вопросе
                  </h3>
                  <p className="credit-ai__empty-text">
                    Выберите подсказку или задайте вопрос. Я читаю доступные
                    демоданные, показываю источники и помогаю перейти к
                    следующему шагу. Это локальный FAQ без LLM.
                  </p>
                </div>
              ) : (
                <div className="credit-ai__conversation">
                  {chat.messages.map((message) => (
                    <AssistantMessage
                      key={message.messageId}
                      message={message}
                      onRetry={() => chat.retry(message)}
                      onNavigate={onClose}
                    />
                  ))}
                </div>
              )}
            </div>
            <AssistantComposer
              busy={chat.busy}
              disabled={isLoading || !!error}
              contextKey={context.contextKey}
              onSend={chat.send}
            />
            <div
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {chat.announcement}
            </div>
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
