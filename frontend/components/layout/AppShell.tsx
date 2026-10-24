import { brand } from "../../shared/brand";
import { identity } from "../../shared/api/identity";
import { ErrorMessage } from "../ui/common";
import { useEffect, useState, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { data } from "../../shared/api/data";
import {
  ActionIcon,
  Button,
  useMantineColorScheme,
  useComputedColorScheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Sparkles, Sun, Moon, Menu } from "lucide-react";
import { useSession } from "../../app/session";
import { Assistant } from "../../features/assistant/Assistant";
import { ExpandableSidebar } from "./ExpandableSidebar";
import {
  bankNavigation,
  adminNavigation,
  clientNavigation,
  isSidebarItemActive,
} from "./sidebarNavigation";

const pinKey = "smart-sidebar-pinned";
export function AppShell() {
  const { session, setSession } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("dark");
  const mobileScreen = useMediaQuery("(max-width: 768px)");
  const touchScreen = useMediaQuery("(hover: none), (pointer: coarse)");
  const canExpandAssistant = useMediaQuery("(min-width: 1440px)");
  const [logoutError, setLogoutError] = useState<Error | null>(null);
  const [mobile, setMobile] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [assistantExpanded, setAssistantExpanded] = useState(false);
  const [pinned, setPinned] = useState(
    () => localStorage.getItem(pinKey) === "true",
  );
  const bank = session?.role !== "CLIENT";
  const company = useQuery({
    queryKey: ["company", session?.username],
    queryFn: () => data.company(session!.username),
    enabled: !!session && !bank && session.onboardingComplete !== false,
  });
  useEffect(() => {
    document.documentElement.dataset.density =
      localStorage.getItem("smart-density") ||
      (bank ? "compact" : "comfortable");
  }, [bank]);
  const links = bank
    ? session?.role === "BANK_ADMIN"
      ? adminNavigation
      : bankNavigation
    : clientNavigation;
  const active = links.find((item) => isSidebarItemActive(item, location));
  const effectivePinned = pinned && !touchScreen;
  const sidebarSpace = mobileScreen ? 0 : effectivePinned ? 224 : 68;
  function pin(value: boolean) {
    setPinned(value);
    localStorage.setItem(pinKey, String(value));
  }
  useEffect(() => {
    const open = () => setAssistant(true);
    window.addEventListener("open-credit-assistant", open);
    return () => window.removeEventListener("open-credit-assistant", open);
  }, []);
  return (
    <div
      className={`app-shell${assistant ? " assistant-open" : ""}`}
      style={
        {
          "--sidebar-space": `${sidebarSpace}px`,
          "--assistant-width": `${assistantExpanded && canExpandAssistant ? 580 : 420}px`,
        } as CSSProperties
      }
    >
      <ExpandableSidebar
        items={links}
        profile={{
          bank,
          name:
            session?.displayName ||
            (bank
              ? session?.role === "BANK_ADMIN"
                ? "Администратор"
                : "Сотрудник банка"
              : "Предприниматель"),
          company: bank
            ? "Кредитный отдел"
            : company.data?.legal_name || "Моя компания",
        }}
        pinned={effectivePinned}
        onPinnedChange={pin}
        mobileOpened={mobile}
        onMobileClose={() => setMobile(false)}
        onLogout={async () => {
          setLogoutError(null);
          try {
            await identity.logout();
            setSession(null);
            navigate("/login");
          } catch (e) {
            setLogoutError(e as Error);
          }
        }}
      />
      <div className="workspace">
        <header className="topbar">
          <ActionIcon
            className="mobile-toggle"
            variant="subtle"
            aria-label="Открыть меню"
            aria-expanded={mobile}
            aria-controls="mobile-sidebar-nav"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </ActionIcon>
          <span className="breadcrumb">
            {bank ? "Банк" : "Кабинет"} / {active?.label || "Заявка"}
          </span>
          <div className="topbar-actions">
            <span className="platform-label">{brand.name}</span>
            <Button
              className="theme-button"
              aria-label="Переключить цветовую тему"
              variant="default"
              leftSection={
                scheme === "dark" ? <Moon size={15} /> : <Sun size={15} />
              }
              onClick={() =>
                setColorScheme(scheme === "dark" ? "light" : "dark")
              }
            >
              {scheme === "dark" ? "Тёмная" : "Светлая"}
            </Button>
            {!bank && (
              <Button
                variant="light"
                aria-label="Открыть помощника"
                leftSection={<Sparkles size={15} />}
                onClick={() => setAssistant(true)}
              >
                Помощник
              </Button>
            )}
          </div>
        </header>
        <ErrorMessage error={logoutError} />
        <main className="content">
          <Outlet />
        </main>
        <footer className="app-footer">
          {brand.name} · {brand.tagline}
        </footer>
      </div>
      {!bank && (
        <>
          {!assistant && (
            <Button
              className="assistant-fab"
              variant="default"
              leftSection={<Sparkles size={18} />}
              onClick={() => setAssistant(true)}
            >
              Помощник
            </Button>
          )}
          <Assistant
            opened={assistant}
            onClose={() => setAssistant(false)}
            expanded={assistantExpanded}
            onExpandedChange={setAssistantExpanded}
          />
        </>
      )}
    </div>
  );
}
