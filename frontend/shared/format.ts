import type { Status } from "./api/types";
export const money = (value: string | number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(value));
export const date = (value: string) =>
  new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const shortId = (id: string) =>
  id.startsWith("SC-") ? id.slice(3) : id.slice(0, 8).toUpperCase();
export const statuses: Record<Status, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Отправлена",
  VERIFYING: "Проверка данных",
  NEEDS_INFO: "Нужны сведения",
  UNDER_REVIEW: "На рассмотрении",
  OFFERED: "Предложение банка",
  REJECTED: "Отказ банка",
  ACCEPTED: "Принята",
  DECLINED: "Предложение отклонено",
  COMPLETED: "Завершена",
};
export const purposeName = (s: string) =>
  ({
    WORKING_CAPITAL: "Пополнение оборотных средств",
    INVESTMENT: "Развитие бизнеса",
    EQUIPMENT: "Покупка оборудования",
  })[s] || s;
export const industryName = (s: string) =>
  ({
    FOOD: "Пищевая промышленность",
    SERVICES: "Услуги",
    TRADE: "Оптовая торговля",
    PRODUCTION: "Производство",
  })[s] || s;
