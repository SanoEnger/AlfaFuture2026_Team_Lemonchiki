import { useState } from "react";
import {
  Button,
  Modal,
  SegmentedControl,
  Switch,
  useMantineColorScheme,
} from "@mantine/core";
import { Monitor, Moon, Sun, RotateCcw, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageTitle, Panel } from "../components/ui/common";
import { data as demo } from "../shared/api/data";
import { Link } from "react-router-dom";
import { useSession } from "./session";
import { ProfileSettings } from "../features/auth/ProfileSettings";
import { isServerMode } from "../shared/api/data";
export function Settings() {
  const { session } = useSession();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [reset, setReset] = useState(false);
  const [density, setDensity] = useState(
    localStorage.getItem("smart-density") ||
      (session?.role !== "CLIENT" ? "compact" : "comfortable"),
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
        {session?.role === "CLIENT" && (
          <Link to="/client/ui-states" className="text-button">
            Посмотреть состояния интерфейса
          </Link>
        )}
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
                aria-describedby={`theme-description-${value}`}
                onClick={() => setColorScheme(value)}
                aria-pressed={colorScheme === value}
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
                <small
                  className="theme-description"
                  id={`theme-description-${value}`}
                >
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
                setMotion(e.currentTarget.checked);
                localStorage.setItem(
                  "smart-motion",
                  e.currentTarget.checked ? "reduce" : "normal",
                );
                document.documentElement.dataset.motion = e.currentTarget
                  .checked
                  ? "reduce"
                  : "normal";
              }}
            />
          </div>
        </Panel>
        {!isServerMode() && (
          <Panel>
            <h3>Демонстрационные данные</h3>
            <p>
              Восстановить исходные заявки, предложения и историю в этом
              браузере.
            </p>
            <Button
              variant="default"
              leftSection={<RotateCcw size={16} />}
              onClick={() => setConfirm(true)}
            >
              Сбросить демоданные
            </Button>
            {reset && (
              <p className="success-text" role="status">
                Демоданные восстановлены
              </p>
            )}
          </Panel>
        )}
      </div>
      <Modal
        opened={confirm}
        onClose={() => setConfirm(false)}
        title="Восстановить демоданные?"
        centered
      >
        <p>
          Созданные вами демозаявки и изменения в браузере будут заменены
          исходными примерами.
        </p>
        <div className="row end">
          <Button variant="default" onClick={() => setConfirm(false)}>
            Отмена
          </Button>
          <Button
            onClick={async () => {
              await demo.reset();
              await qc.invalidateQueries();
              setConfirm(false);
              setReset(true);
            }}
          >
            Восстановить
          </Button>
        </div>
      </Modal>
    </>
  );
}
