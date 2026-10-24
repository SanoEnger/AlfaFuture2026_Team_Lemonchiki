import type { Application, Status } from "../../shared/api/types";

export interface NextAction {
  title: string;
  description: string;
  action?: { label: string; to: string };
}
export function deriveNextAction(a: Application): NextAction {
  const base = `/client/applications/${a.id}`;
  const states: Record<Status, NextAction> = {
    DRAFT: {
      title: "Продолжите оформление",
      description: "Проверьте параметры и сведения компании перед отправкой.",
      action: {
        label: "Открыть черновик",
        to: `/client/applications/new?draft=${a.id}`,
      },
    },
    SUBMITTED: {
      title: "Заявка отправлена",
      description: "Ожидайте начала проверок. Повторная отправка не требуется.",
    },
    VERIFYING: {
      title: "Идут проверки",
      description:
        "После проверок заявка поступит на рассмотрение. Срок решения не указан.",
    },
    UNDER_REVIEW: {
      title: "Банк рассматривает заявку",
      description:
        "Дополнительных действий сейчас не требуется. Решение появится в карточке заявки.",
    },
    NEEDS_INFO: {
      title: "Банк запросил сведения",
      description: "Действующий запрос не найден. Обновите данные заявки.",
    },
    OFFERED: {
      title: "Подготовлено предложение",
      description:
        "Условия предложения пока недоступны. Обновите данные заявки.",
    },
    REJECTED: {
      title: "Банк отказал",
      description:
        a.events.filter((e) => e.to_status === "REJECTED").at(-1)?.reason ||
        "Комментарий к решению не указан.",
      action: { label: "Посмотреть решение", to: `${base}#history` },
    },
    ACCEPTED: {
      title: "Предложение принято",
      description:
        "Ожидайте завершения процесса. Повторное принятие не требуется.",
    },
    DECLINED: {
      title: "Предложение отклонено",
      description: "Решение сохранено в истории заявки.",
      action: { label: "Просмотреть историю", to: `${base}#history` },
    },
    COMPLETED: {
      title: "Процесс завершён",
      description: "Итоговые условия и события доступны в карточке заявки.",
      action: { label: "Итоговая информация", to: `${base}#history` },
    },
  };
  if (a.status === "NEEDS_INFO") {
    const requests = a.information_requests.filter((r) => r.status === "OPEN");
    if (requests.length)
      return {
        title: states.NEEDS_INFO.title,
        description: requests.map((r) => r.message).join("\n"),
        action: { label: "Ответить на запрос", to: `${base}#documents` },
      };
  }
  if (a.status === "OFFERED" && a.latest_offer)
    return {
      title: states.OFFERED.title,
      description:
        "Сравните исходный запрос с предложением банка и подтвердите своё решение.",
      action: { label: "Сравнить условия", to: `${base}#offer` },
    };
  return states[a.status];
}
