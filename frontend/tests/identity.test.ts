import { it, expect, vi, afterEach } from "vitest";
import { identity } from "../shared/api/identity";
import { clearCsrf } from "../shared/api/http";
afterEach(() => {
  clearCsrf();
  vi.unstubAllGlobals();
});
it("создаёт аккаунт через API с cookie и CSRF", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{"csrf_token":"signed"}'))
    .mockResolvedValueOnce(new Response("{}", { status: 202 }));
  vi.stubGlobal("fetch", fetch);
  await identity.register("Имя", "user@example.test", "StrongPassword42");
  expect(fetch.mock.calls[1][0]).toContain("/auth/register");
  expect(fetch.mock.calls[1][1].credentials).toBe("include");
  expect(fetch.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe("signed");
  expect(JSON.parse(fetch.mock.calls[1][1].body).email).toBe(
    "user@example.test",
  );
});
