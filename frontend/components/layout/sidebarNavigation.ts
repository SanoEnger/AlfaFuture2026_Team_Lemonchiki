import {
  Building2,
  ClipboardCheck,
  Files,
  Folder,
  History,
  Home,
  LayoutGrid,
  ListFilter,
  Newspaper,
  Plus,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Location } from "react-router-dom";
export interface SidebarItem {
  id: string;
  to: string;
  label: string;
  icon: LucideIcon;
}
export const clientNavigation: SidebarItem[] = [
  { id: "dashboard", to: "/client/dashboard", label: "Главная", icon: Home },
  {
    id: "applications",
    to: "/client/applications",
    label: "Мои заявки",
    icon: Files,
  },
  {
    id: "new",
    to: "/client/applications/new",
    label: "Новая заявка",
    icon: Plus,
  },
  {
    id: "products",
    to: "/client/products",
    label: "Продукты",
    icon: LayoutGrid,
  },
  {
    id: "company",
    to: "/client/company",
    label: "Моя компания",
    icon: Building2,
  },
  {
    id: "documents",
    to: "/client/documents",
    label: "Документы",
    icon: Folder,
  },
  { id: "news", to: "/client/news", label: "Новости", icon: Newspaper },
  {
    id: "settings",
    to: "/client/settings",
    label: "Настройки",
    icon: Settings,
  },
];
export const bankNavigation: SidebarItem[] = [
  {
    id: "queue",
    to: "/bank/applications",
    label: "Очередь заявок",
    icon: ListFilter,
  },
  {
    id: "review",
    to: "/bank/applications?view=review",
    label: "Рассмотрение",
    icon: ClipboardCheck,
  },
  {
    id: "history",
    to: "/bank/applications?view=history",
    label: "История решений",
    icon: History,
  },
  { id: "settings", to: "/bank/settings", label: "Настройки", icon: Settings },
];
export const adminNavigation: SidebarItem[] = [
  {
    id: "administration",
    to: "/bank/administration",
    label: "Администрирование",
    icon: Users,
  },
  {
    id: "queue",
    to: "/bank/applications",
    label: "Очередь заявок",
    icon: ListFilter,
  },
  { id: "settings", to: "/bank/settings", label: "Настройки", icon: Settings },
];

export function isSidebarItemActive(
  item: SidebarItem,
  location: Pick<Location, "pathname" | "search">,
): boolean {
  const { pathname, search } = location;
  if (item.id === "administration")
    return pathname.startsWith("/bank/administration");
  if (item.to.startsWith("/bank/applications")) {
    const view = new URLSearchParams(search).get("view");
    if (pathname.startsWith("/bank/applications/")) return item.id === "review";
    return (
      pathname === "/bank/applications" &&
      item.id ===
        (view === "review"
          ? "review"
          : view === "history"
            ? "history"
            : "queue")
    );
  }
  if (item.id === "applications")
    return (
      pathname.startsWith(item.to) && pathname !== "/client/applications/new"
    );
  return pathname === item.to;
}
