import { Tooltip } from "@mantine/core";
import { NavLink } from "react-router-dom";
import type { SidebarItem } from "./sidebarNavigation";
export function SidebarNavItem({
  item,
  expanded,
  active,
  onSelect,
  onRequestOpen,
  touch,
}: {
  item: SidebarItem;
  expanded: boolean;
  active: boolean;
  touch: boolean;
  onSelect: () => void;
  onRequestOpen: () => void;
}) {
  const Icon = item.icon;
  return (
    <Tooltip
      label={item.label}
      disabled={expanded || touch}
      position="right"
      withArrow
      openDelay={350}
    >
      <NavLink
        to={item.to}
        aria-label={item.label}
        aria-current={active ? "page" : false}
        data-active={active}
        className="sidebar-nav-item"
        onClick={(e) => {
          if (touch && !expanded) {
            e.preventDefault();
            onRequestOpen();
          } else onSelect();
        }}
        onKeyDown={(e) => {
          if (e.key === " ") {
            e.preventDefault();
            e.currentTarget.click();
          }
        }}
      >
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        <span className="sidebar-copy sidebar-nav-label" aria-hidden="true">
          {item.label}
        </span>
      </NavLink>
    </Tooltip>
  );
}
