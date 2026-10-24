import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, setAccessToken } from "../shared/api/http";
const memory = new Map<string, string>();
const dispatch = vi.fn();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
  });
  vi.stubGlobal("window", { dispatchEvent: dispatch });
  dispatch.mockClear();
  setAccessToken(null);
});
afterEach(() => vi.restoreAllMocks());
describe("HTTP без подстановки демоданных", () => {
  it("передаёт Bearer и JSON только в нужных заголовках", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    setAccessToken("synthetic-token");
    expect(
      await request("/example", {
        method: "POST",
        body: JSON.stringify({ amount: "0.25" }),
      }),
    ).toEqual({ ok: true });
    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Authorization")).toBe("Bearer synthetic-token");
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });
  it("при 401 очищает токен и сообщает об истечении без повторных запросов", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('{"message":"Требуется вход"}', { status: 401 }),
      );
    vi.stubGlobal("fetch", fetch);
    setAccessToken("expired-demo-token");
    await expect(request("/applications")).rejects.toMatchObject({
      status: 401,
    });
    expect(memory.has("smart-credit-api-token")).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("возвращает сеть/409 как ошибку, а не данные локального seed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(request("/applications")).rejects.toMatchObject({ status: 0 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"Статус изменён"}', { status: 409 }),
        ),
    );
    await expect(request("/applications")).rejects.toMatchObject({
      status: 409,
      message: "Статус изменён",
    });
  });
  it("сохраняет отмену запроса и boundary для multipart", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await request("/documents", { method: "POST", body: new FormData() });
    expect(fetch.mock.calls[0][1].headers.has("Content-Type")).toBe(false);
    const aborted = new DOMException("cancelled", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));
    await expect(request("/applications")).rejects.toBe(aborted);
  });
});
