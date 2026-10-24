import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Modal, Select } from "@mantine/core";
import { FileText, Upload, Eye, Download } from "lucide-react";
import { isServerMode } from "../../shared/api/data";
import { server } from "../../shared/api/server";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "../../app/session";
import { data as demo } from "../../shared/api/data";
import type { Application, Document } from "../../shared/api/types";
import { date, shortId } from "../../shared/format";
import { DocumentChecklist } from "./DocumentChecklist";
import {
  Empty,
  ErrorMessage,
  PageTitle,
  Panel,
  QueryState,
} from "../../components/ui/common";
export function DocumentList({
  application,
  bank = false,
}: {
  application: Application;
  bank?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Document | null>(null);
  const [downloadError, setDownloadError] = useState<Error | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const mutation = useMutation({
    mutationFn: (f: File) => demo.upload(application.id, f),
    onSuccess: () => qc.invalidateQueries(),
  });
  const canUpload =
    !bank && ["DRAFT", "NEEDS_INFO"].includes(application.status);
  function upload(file: File) {
    if (!canUpload || mutation.isPending) return;
    setLastFile(file);
    mutation.mutate(file);
  }
  return (
    <>
      <div className="section-title">
        <div>
          <h3>Документы по заявке</h3>
          <p>PDF · до 5 МБ</p>
        </div>
        {!bank && (
          <>
            <input
              hidden
              ref={input}
              type="file"
              accept=".pdf,application/pdf"
              aria-label="Выбрать PDF"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="default"
              leftSection={<Upload size={16} />}
              disabled={!canUpload}
              loading={mutation.isPending}
              onClick={() => input.current?.click()}
            >
              Добавить PDF
            </Button>
          </>
        )}
      </div>
      <DocumentChecklist application={application} />
      {canUpload && (
        <div
          className="document-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) upload(file);
          }}
        >
          <p>Перетащите PDF сюда или выберите файл кнопкой «Добавить PDF»</p>
          <small>
            До 5 МБ. Запрос остаётся открытым до отправки ответа банку.
          </small>
        </div>
      )}
      {!bank && !canUpload && (
        <p className="muted">
          Добавление документов доступно в черновике и при запросе уточнений.
        </p>
      )}
      <ErrorMessage error={mutation.error} />
      <ErrorMessage error={downloadError} />
      {mutation.isError && lastFile && canUpload && (
        <Button variant="default" onClick={() => upload(lastFile)}>
          Повторить загрузку
        </Button>
      )}
      {mutation.isSuccess && (
        <p className="success-text" role="status">
          Документ добавлен
        </p>
      )}
      {application.documents.length ? (
        <div className="document-list">
          {application.documents.map((d) => (
            <div className="document-row" key={d.id}>
              <FileText size={24} className="accent" />
              <div>
                <strong>{d.file_name}</strong>
                <small>
                  {Math.ceil(d.size_bytes / 1024)} КБ · {date(d.created_at)}
                </small>
              </div>
              <Button
                aria-label={`Сведения о ${d.file_name}`}
                variant="subtle"
                color="gray"
                onClick={() => setSelected(d)}
              >
                <Eye size={17} />
              </Button>
              {isServerMode() && (
                <Button
                  aria-label={`Скачать ${d.file_name}`}
                  variant="subtle"
                  loading={downloading === d.id}
                  onClick={async () => {
                    setDownloading(d.id);
                    setDownloadError(null);
                    try {
                      await server.download(
                        application.id,
                        d.id,
                        d.file_name,
                        bank,
                      );
                    } catch (e) {
                      setDownloadError(e as Error);
                    } finally {
                      setDownloading(null);
                    }
                  }}
                >
                  <Download size={17} />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Документы ещё не добавлены">
          <p>
            {canUpload
              ? "Прикрепите PDF к этой заявке"
              : "Здесь появятся документы по заявке"}
          </p>
        </Empty>
      )}
      {!isServerMode() && (
        <p className="muted">
          Демо-режим: сохраняются только сведения о файле. Содержимое PDF не
          хранится и не отправляется на сервер.
        </p>
      )}
      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title="Сведения о документе"
        centered
      >
        {selected && (
          <>
            <FileText size={32} className="accent" />
            <h3>{selected.file_name}</h3>
            <p>
              {Math.ceil(selected.size_bytes / 1024)} КБ ·{" "}
              {date(selected.created_at)}
            </p>
            <Alert color="gray">
              {isServerMode()
                ? "Содержимое файла доступно по кнопке скачивания после проверки сервером прав на заявку."
                : "В автономном прототипе доступна карточка файла. Просмотр содержимого PDF не предусмотрен."}
            </Alert>
          </>
        )}
      </Modal>
    </>
  );
}
export function Documents() {
  const { session } = useSession();
  const q = useQuery({
    queryKey: ["applications", session?.username],
    queryFn: () => demo.applications(session!.username),
  });
  const [params, setParams] = useSearchParams();
  const id = params.get("application");
  const a = q.data?.find((a) => a.id === id) || q.data?.[0];
  return (
    <>
      <PageTitle
        title="Документы"
        subtitle="Файлы и запросы по вашим кредитным заявкам"
      />
      <QueryState query={q}>
        {a ? (
          <>
            <Select
              className="application-select"
              label="Заявка"
              value={a.id}
              onChange={(id) =>
                setParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    if (id) next.set("application", id);
                    else next.delete("application");
                    return next;
                  },
                  { replace: true },
                )
              }
              data={q.data!.map((a) => ({
                value: a.id,
                label: `№${shortId(a.id)} · ${a.company.legal_name}`,
              }))}
            />
            <Panel>
              <DocumentList application={a} />
              {a.information_requests
                .filter((r) => r.status === "OPEN")
                .map((r) => (
                  <Alert color="yellow" key={r.id} title="Запрос банка">
                    <p>{r.message}</p>
                    <Button
                      component={Link}
                      to={`/client/applications/${a.id}`}
                      variant="light"
                    >
                      Ответить на запрос
                    </Button>
                  </Alert>
                ))}
            </Panel>
          </>
        ) : (
          <Panel>
            <Empty title="Пока нет заявок">
              <Button component={Link} to="/client/applications/new">
                Создать заявку
              </Button>
            </Empty>
          </Panel>
        )}
      </QueryState>
    </>
  );
}
