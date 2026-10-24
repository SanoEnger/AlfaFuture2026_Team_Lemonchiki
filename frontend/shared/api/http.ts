import { ApiError } from "./errors";
const base = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  "",
);
let csrf: string | null = null;
let pendingCsrf: Promise<string> | null = null;
export function clearCsrf() {
  csrf = null;
  pendingCsrf = null;
}
async function bootstrap(): Promise<string> {
  if (csrf) return csrf;
  if (!pendingCsrf)
    pendingCsrf = fetch(`${base}/auth/csrf`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok)
          throw new ApiError(
            r.status,
            "Не удалось проверить сеанс. Обновите страницу.",
          );
        const b = (await r.json()) as { csrf_token: string };
        csrf = b.csrf_token;
        return csrf;
      })
      .finally(() => {
        pendingCsrf = null;
      });
  return pendingCsrf;
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const headers = new Headers(init.headers);
  const method = init.method || "GET";
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("X-CSRF-Token", await bootstrap());
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      signal,
      credentials: "include",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new ApiError(
      0,
      "Не удалось связаться с сервером. Проверьте подключение.",
    );
  }
  if (!response.ok) {
    let body: { message?: string; details?: Record<string, string> } = {};
    try {
      body = await response.json();
    } catch {}
    if (response.status === 401) {
      clearCsrf();
      window.dispatchEvent(new Event("credit-auth-expired"));
    }
    if (response.status === 403) clearCsrf();
    throw new ApiError(
      response.status,
      body.message || `Ошибка сервера ${response.status}`,
      body.details,
    );
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (result && typeof result === "object" && "csrf_token" in result)
    csrf = result.csrf_token;
  return result as T;
}
export async function downloadFile(path: string, name: string) {
  const response = await fetch(`${base}${path}`, { credentials: "include" });
  if (!response.ok)
    throw new ApiError(response.status, "Документ недоступен для скачивания");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
