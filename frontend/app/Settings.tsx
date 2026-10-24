import { useState } from "react";
import { SegmentedControl, Switch, useMantineColorScheme } from "@mantine/core";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { PageTitle, Panel } from "../components/ui/common";
import { ProfileSettings } from "../features/auth/ProfileSettings";
import { useSession } from "./session";
export function Settings() {
  const { session } = useSession();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [density, setDensity] = useState(
    localStorage.getItem("smart-density") ||
      (session?.role === "CLIENT" ? "comfortable" : "compact"),
  );
  const [motion, setMotion] = useState(
    localStorage.getItem("smart-motion") === "reduce",
  );
  return (
    <>
      <PageTitle
        title="Настройки оформления"
        subtitle="Настройте кабинет для комфортной работы"
      />
      <div className="settings-stack">
        <ProfileSettings />
        <Panel>
          <h3>Цветовая тема</h3>
          <p>Выберите оформление интерфейса</p>
          <div className="theme-options">
            {(
              [
                ["dark", "Тёмная", Moon],
                ["light", "Светлая", Sun],
                ["auto", "Системная", Monitor],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                className={`theme-option ${colorScheme === value ? "selected" : ""}`}
                aria-label={label}
                aria-pressed={colorScheme === value}
                onClick={() => setColorScheme(value)}
              >
                <div className={`theme-preview preview-${value}`}>
                  <i />
                  <div>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <span>
                  <Icon size={17} />
                  {label}
                  {colorScheme === value && <Check size={16} />}
                </span>
                <small className="theme-description">
                  {value === "dark"
                    ? "Graphite Glow"
                    : value === "light"
                      ? "Pearl Light"
                      : "По настройкам ОС"}
                </small>
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          <h3>Удобство работы</h3>
          <div className="setting-row">
            <div>
              <strong>Плотность интерфейса</strong>
              <p>Расстояние между строками таблиц</p>
            </div>
            <SegmentedControl
              value={density}
              onChange={(v) => {
                setDensity(v);
                localStorage.setItem("smart-density", v);
                document.documentElement.dataset.density = v;
              }}
              data={[
                { value: "comfortable", label: "Обычная" },
                { value: "compact", label: "Компактная" },
              ]}
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Уменьшить движение</strong>
              <p>Отключить необязательные анимации</p>
            </div>
            <Switch
              aria-label="Уменьшить движение"
              checked={motion}
              onChange={(e) => {
                const v = e.currentTarget.checked;
                setMotion(v);
                localStorage.setItem("smart-motion", v ? "reduce" : "normal");
                document.documentElement.dataset.motion = v
                  ? "reduce"
                  : "normal";
              }}
            />
          </div>
        </Panel>
      </div>
    </>
  );
}
