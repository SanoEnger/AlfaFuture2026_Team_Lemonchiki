import { useState } from "react";
import { Alert, Button, Skeleton, TextInput } from "@mantine/core";
import { AlertCircle, CheckCircle2, Plus, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Empty, PageTitle, Panel, StatusBadge } from "../components/ui/common";
import { statuses } from "../shared/format";
import type { Status } from "../shared/api/types";
export function UIStates() {
  const [retry, setRetry] = useState(false);
  return (
    <>
      <PageTitle
        title="Состояния интерфейса"
        subtitle="Как кабинет сообщает о загрузке, результате и доступных действиях"
      />
      <div className="product-grid">
        <Panel>
          <h3>Загрузка</h3>
          <p>Подготовка данных заявки</p>
          <Skeleton height={16} width="55%" />
          <Skeleton height={40} mt={20} />
          <Skeleton height={16} mt={16} width="80%" />
        </Panel>
        <Panel>
          <h3>Ошибка загрузки</h3>
          {retry ? (
            <Alert
              color="green"
              icon={<CheckCircle2 size={18} />}
              title="Данные загружены"
            >
              Повторная попытка выполнена успешно.
            </Alert>
          ) : (
            <Alert
              color="red"
              icon={<AlertCircle size={18} />}
              title="Не удалось загрузить данные"
            >
              Проверьте подключение и повторите попытку.
            </Alert>
          )}
          <Button
            variant="default"
            leftSection={<RotateCcw size={16} />}
            onClick={() => setRetry(!retry)}
          >
            {retry ? "Показать ошибку" : "Повторить"}
          </Button>
        </Panel>
        <Panel>
          <Empty title="Заявок пока нет">
            <p>Начните с выбора кредитного продукта</p>
            <Button
              component={Link}
              to="/client/applications/new"
              leftSection={<Plus size={16} />}
            >
              Создать заявку
            </Button>
          </Empty>
        </Panel>
        <Panel>
          <h3>Успешное действие</h3>
          <Alert
            color="green"
            title="Заявка отправлена"
            icon={<CheckCircle2 size={18} />}
          >
            Статус и история обновлены.
          </Alert>
          <TextInput
            label="Сумма кредита, ₽"
            defaultValue="0"
            error="Укажите сумму в диапазоне выбранного продукта"
          />
          <p className="muted">Отправка доступна после исправления данных.</p>
          <Button disabled>Отправить заявку</Button>
        </Panel>
      </div>
      <Panel className="states-statuses">
        <h3>Статусы заявки</h3>
        <p>Каждый статус обозначен цветом и текстом</p>
        <div className="row">
          {(Object.keys(statuses) as Status[]).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Panel>
    </>
  );
}
