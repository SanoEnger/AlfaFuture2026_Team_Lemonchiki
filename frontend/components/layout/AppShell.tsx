import { useEffect, useState, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
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
  const [mobile, setMobile] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [pinned, setPinned] = useState(
    () => localStorage.getItem(pinKey) === "true",
  );
  const bank = session?.role === "BANK_EMPLOYEE";
  const links = bank ? bankNavigation : clientNavigation;
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
      style={{ "--sidebar-space": `${sidebarSpace}px` } as CSSProperties}
    >
      <ExpandableSidebar
        items={links}
        profile={{
          bank,
          name: bank ? "Сотрудник банка" : "Александр",
          company: bank
            ? "Кредитный отдел"
            : session?.username === "client_risky"
              ? "ИП Сервис"
              : "ООО «Вектор»",
        }}
        pinned={effectivePinned}
        onPinnedChange={pin}
        mobileOpened={mobile}
        onMobileClose={() => setMobile(false)}
        onLogout={() => {
          setSession(null);
          navigate("/login");
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
            <span className="demo-label">Демо-режим</span>
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
                leftSection={<Sparkles size={15} />}
                onClick={() => setAssistant(true)}
              >
                AI
              </Button>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <footer className="app-footer">
          SMART CREDIT · Демонстрационные продукты и данные
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
              AI-помощник
            </Button>
          )}
          <Assistant opened={assistant} onClose={() => setAssistant(false)} />
        </>
      )}
    </div>
  );
}
