import { demo, restoreDemoCatalog } from "./demo";
import { server } from "./server";
import { DemoError } from "./errors";
export const isServerMode = () =>
  typeof sessionStorage !== "undefined" &&
  sessionStorage.getItem("smart-credit-data-mode") === "api";
export function setDataMode(mode: "demo" | "api") {
  sessionStorage.setItem("smart-credit-data-mode", mode);
  if (mode === "demo") restoreDemoCatalog();
}
// Same view-model contract, selected explicitly; server errors never fall back to seed data.
export const data = {
  ...demo,
  claim: (...args: Parameters<typeof demo.claim>) =>
    isServerMode()
      ? Promise.reject(
          new DemoError(
            501,
            "Назначение ответственного не поддерживается этим сервером",
          ),
        )
      : demo.claim(...args),
  assign: (...args: Parameters<typeof demo.assign>) =>
    isServerMode()
      ? Promise.reject(
          new DemoError(501, "Переназначение не поддерживается этим сервером"),
        )
      : demo.assign(...args),
  products: () => (isServerMode() ? server.products() : demo.products()),
  company: (owner: string) =>
    isServerMode() ? server.company(owner) : demo.company(owner),
  updateCompany: (
    owner: string,
    c: Parameters<typeof demo.updateCompany>[1],
  ) =>
    isServerMode()
      ? server.updateCompany(owner, c)
      : demo.updateCompany(owner, c),
  applications: (owner?: string) =>
    isServerMode() ? server.applications(owner) : demo.applications(owner),
  application: (id: string, owner?: string) =>
    isServerMode()
      ? server.application(id, owner)
      : demo.application(id, owner),
  saveDraft: (...args: Parameters<typeof demo.saveDraft>) =>
    isServerMode() ? server.saveDraft(...args) : demo.saveDraft(...args),
  submit: (id: string) =>
    isServerMode() ? server.submit(id) : demo.submit(id),
  requestInfo: (...args: Parameters<typeof demo.requestInfo>) =>
    isServerMode()
      ? server.requestInfo(args[0], args[1])
      : demo.requestInfo(...args),
  resubmit: (id: string, message: string) =>
    isServerMode() ? server.resubmit(id, message) : demo.resubmit(id, message),
  decision: (...args: Parameters<typeof demo.decision>) =>
    isServerMode()
      ? server.decision(args[0], args[1], args[2], args[3])
      : demo.decision(...args),
  respond: (id: string, accept: boolean) =>
    isServerMode() ? server.respond(id, accept) : demo.respond(id, accept),
  complete: (id: string, owner: string) =>
    isServerMode() ? server.complete(id, owner) : demo.complete(id, owner),
  upload: (id: string, file: File) =>
    isServerMode() ? server.upload(id, file) : demo.upload(id, file),
  news: (owner: string) =>
    isServerMode() ? server.news(owner) : demo.news(owner),
};
