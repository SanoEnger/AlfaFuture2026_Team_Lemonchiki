import { Tooltip } from "@mantine/core";
import { LogOut, ShieldCheck } from "lucide-react";
export interface SidebarProfileData {
  name: string;
  company: string;
  bank: boolean;
}
export function SidebarProfile({
  profile,
  expanded,
  onLogout,
}: {
  profile: SidebarProfileData;
  expanded: boolean;
  onLogout: () => void;
}) {
  return (
    <div className="rail-profile">
      <Tooltip
        label={`${profile.name} · ${profile.company}`}
        disabled={expanded}
        position="right"
      >
        <div className="rail-profile-identity">
          <span className="rail-avatar" role="img" aria-label={profile.name}>
            {profile.bank ? (
              <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              "А"
            )}
          </span>
          <div className="sidebar-copy rail-profile-copy">
            <strong>{profile.name}</strong>
            <small>{profile.company}</small>
          </div>
        </div>
      </Tooltip>
      <Tooltip label="Выйти" position="right" disabled={expanded}>
        <button
          className="rail-icon-button rail-logout"
          type="button"
          aria-label="Выйти"
          onClick={onLogout}
        >
          <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
          <span className="sidebar-copy">Выйти</span>
        </button>
      </Tooltip>
    </div>
  );
}
