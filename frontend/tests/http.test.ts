import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { request, clearCsrf } from "../shared/api/http";
beforeEach(() => {
  clearCsrf();
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
it("передаёт cookie и CSRF для команд, не создаёт Bearer", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{"csrf_token":"signed"}'))
    .mockResolvedValueOnce(new Response('{"ok":true}'));
  vi.stubGlobal("fetch", fetch);
  expect(await request("/example", { method: "POST", body: "{}" })).toEqual({
    ok: true,
  });
  const init = fetch.mock.calls[1][1];
  expect(init.credentials).toBe("include");
  expect(init.headers.get("X-CSRF-Token")).toBe("signed");
  expect(init.headers.has("Authorization")).toBe(false);
});
it("не подменяет ошибки сервера локальными данными", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response('{"message":"Изменено"}', { status: 409 }),
      ),
  );
  await expect(request("/applications")).rejects.toMatchObject({
    status: 409,
    message: "Изменено",
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
  await expect(request("/applications")).rejects.toMatchObject({ status: 0 });
});
it("сообщает об истечении сеанса", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
  );
  await expect(request("/applications")).rejects.toMatchObject({ status: 401 });
  expect(window.dispatchEvent).toHaveBeenCalledOnce();
});
it("сохраняет AbortError", async () => {
  const error = new DOMException("cancelled", "AbortError");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
  await expect(request("/applications")).rejects.toBe(error);
});
