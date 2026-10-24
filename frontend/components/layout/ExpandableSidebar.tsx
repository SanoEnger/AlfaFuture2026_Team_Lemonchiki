import { brand } from "../../shared/brand";
import { BrandMark } from "../ui/Brand";
import { useEffect, useRef, useState } from "react";
import { Drawer, Tooltip } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { Menu, Pin, PinOff, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProfile, type SidebarProfileData } from "./SidebarProfile";
import { isSidebarItemActive, type SidebarItem } from "./sidebarNavigation";

interface Props {
  items: SidebarItem[];
  profile: SidebarProfileData;
  pinned: boolean;
  onPinnedChange: (value: boolean) => void;
  mobileOpened: boolean;
  onMobileClose: () => void;
  onLogout: () => void;
}
export function ExpandableSidebar({
  items,
  profile,
  pinned,
  onPinnedChange,
  mobileOpened,
  onMobileClose,
  onLogout,
}: Props) {
  const location = useLocation();
  const mobile = useMediaQuery("(max-width: 768px)");
  const coarse = useMediaQuery("(hover: none), (pointer: coarse)");
  const [hovered, setHovered] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const rail = useRef<HTMLElement>(null);
  const touchTrigger = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const expanded =
    !mobile &&
    (pinned || (!dismissed && (hovered || keyboardOpen || touchOpen)));
  function closeTemporary() {
    setTouchOpen(false);
    setKeyboardOpen(false);
    setDismissed(true);
  }
  function openTouch() {
    setDismissed(false);
    setTouchOpen(true);
  }
  useEffect(() => {
    setTouchOpen(false);
    setDismissed(false);
    onMobileClose();
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (mobile || pinned || !expanded) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        closeTemporary();
        if (coarse) touchTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [expanded, pinned, mobile, coarse]);
  useEffect(() => {
    if (!coarse || !touchOpen || mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [coarse, touchOpen, mobile]);
  function content(open: boolean, isMobile = false) {
    return (
      <>
        <div className="rail-brand">
          {coarse && !isMobile ? (
            <button
              ref={touchTrigger}
              className="rail-logo rail-icon-button"
              type="button"
              aria-label={expanded ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={expanded}
              aria-controls="desktop-sidebar-nav"
              onClick={() => (expanded ? closeTemporary() : openTouch())}
            >
              <Menu size={20} strokeWidth={1.8} />
            </button>
          ) : (
            <span className="rail-logo" aria-label={brand.name}>
              <BrandMark size={36} />
            </span>
          )}
          <span className="sidebar-copy rail-wordmark" aria-hidden="true">
            {brand.name}
            <small>{brand.tagline}</small>
          </span>
          {isMobile && (
            <button
              className="rail-icon-button rail-mobile-close"
              type="button"
              aria-label="Закрыть меню"
              onClick={onMobileClose}
            >
              <X size={20} />
            </button>
          )}
        </div>
        {!isMobile && !coarse && (
          <Tooltip
            label={pinned ? "Открепить меню" : "Закрепить меню"}
            disabled={open}
            position="right"
          >
            <button
              type="button"
              className="rail-icon-button rail-pin"
              aria-label={pinned ? "Открепить меню" : "Закрепить меню"}
              aria-pressed={pinned}
              onClick={() => {
                clearTimeout(hoverTimer.current);
                if (rail.current?.matches(":hover")) setHovered(true);
                onPinnedChange(!pinned);
                setKeyboardOpen(false);
              }}
            >
              {pinned ? (
                <PinOff size={20} strokeWidth={1.8} />
              ) : (
                <Pin size={20} strokeWidth={1.8} />
              )}
              <span className="sidebar-copy">
                {pinned ? "Открепить" : "Закрепить"}
              </span>
            </button>
          </Tooltip>
        )}
        <div className="rail-caption">
          <span className="sidebar-copy">
            {profile.bank ? "РАБОЧАЯ ОБЛАСТЬ" : "НАВИГАЦИЯ"}
          </span>
        </div>
        <nav
          id={isMobile ? "mobile-sidebar-nav" : "desktop-sidebar-nav"}
          aria-label="Основная навигация"
          className="rail-nav"
        >
          {items.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              expanded={open}
              touch={!!coarse && !isMobile}
              active={isSidebarItemActive(item, location)}
              onRequestOpen={openTouch}
              onSelect={() => {
                if (isMobile) onMobileClose();
                else if (coarse) closeTemporary();
              }}
            />
          ))}
        </nav>
        <SidebarProfile profile={profile} expanded={open} onLogout={onLogout} />
      </>
    );
  }
  return (
    <>
      {!mobile && coarse && expanded && !pinned && (
        <button
          className="sidebar-backdrop"
          type="button"
          tabIndex={-1}
          aria-label="Закрыть меню нажатием вне панели"
          onClick={() => {
            closeTemporary();
            touchTrigger.current?.focus();
          }}
        />
      )}
      {!mobile && (
        <aside
          ref={rail}
          aria-label="Боковая панель"
          className="expandable-sidebar"
          data-expanded={expanded}
          data-pinned={pinned}
          data-touch={coarse || undefined}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse" && !coarse) {
              setDismissed(false);
              clearTimeout(hoverTimer.current);
              hoverTimer.current = setTimeout(() => setHovered(true), 180);
            }
          }}
          onPointerLeave={() => {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = setTimeout(() => setHovered(false), 280);
          }}
          onFocusCapture={(e) => {
            if (
              e.target.matches(":focus-visible") &&
              !rail.current?.contains(e.relatedTarget as Node | null)
            ) {
              setDismissed(false);
              setKeyboardOpen(true);
            }
          }}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setKeyboardOpen(false);
          }}
        >
          {content(expanded)}
        </aside>
      )}
      <Drawer
        opened={!!mobile && mobileOpened}
        onClose={onMobileClose}
        position="left"
        size={224}
        title="Навигация"
        withCloseButton={false}
        className="sidebar-mobile-drawer"
        overlayProps={{ backgroundOpacity: 0.4 }}
      >
        <div
          className="expandable-sidebar sidebar-mobile-panel"
          data-expanded="true"
        >
          {content(true, true)}
        </div>
      </Drawer>
    </>
  );
}
