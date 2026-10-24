import { DemoError } from "./errors";
let token: string | null =
  typeof sessionStorage !== "undefined"
    ? sessionStorage.getItem("smart-credit-api-token")
    : null;
export const setAccessToken = (value: string | null) => {
  token = value;
  if (typeof sessionStorage !== "undefined") {
    if (value) sessionStorage.setItem("smart-credit-api-token", value);
    else sessionStorage.removeItem("smart-credit-api-token");
  }
};
export const hasAccessToken = () => !!token;
const base = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  "",
);
export async function request<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new DemoError(
      0,
      "Не удалось связаться с сервером. Проверьте подключение и адрес API.",
    );
  }
  if (!response.ok) {
    let body: {
      message?: string;
      error_code?: string;
      details?: Record<string, string>;
      detail?: unknown;
    } = {};
    try {
      body = await response.json();
    } catch {}
    const e = new DemoError(
      response.status,
      body.message || `Сервер вернул ошибку ${response.status}`,
      body.details,
    );
    if (response.status === 401) {
      setAccessToken(null);
      window.dispatchEvent(new Event("credit-auth-expired"));
    }
    throw e;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function downloadFile(path: string, name: string) {
  const response = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok)
    throw new DemoError(response.status, "Документ недоступен для скачивания");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
