import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, user = "client_good") {
  await page.goto("/login");
  await page.getByLabel("Email или логин").fill(user);
  await page
    .getByRole("textbox", { name: "Пароль", exact: true })
    .fill("Demo2026!");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(
    /client\/dashboard|bank\/applications|bank\/administration/,
  );
}
test("защищённые маршруты требуют входа", async ({ page }) => {
  for (const path of [
    "/client/dashboard",
    "/bank/applications",
    "/bank/administration",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/login$/);
  }
  await expect(page).toHaveTitle("ФинМаршрут — Платформа кредитования бизнеса");
  await expect(
    page.getByRole("heading", { name: "ФинМаршрут", exact: true }),
  ).toBeVisible();
});
test("сеанс восстанавливается с сервера и закрывается после выхода", async ({
  page,
}) => {
  await login(page);
  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.locator(".expandable-sidebar").hover();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  await page.goto("/client/applications");
  await expect(page).toHaveURL(/login$/);
});
for (const theme of ["dark", "light"]) {
  for (const width of [390, 768, 1280, 1920]) {
    test("тема " + theme + " ширина " + width, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(
        (t) => localStorage.setItem("mantine-color-scheme-value", t),
        theme,
      );
      await login(page);
      await expect(page.locator("html")).toHaveAttribute(
        "data-mantine-color-scheme",
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await expect(page.locator("body")).not.toContainText(
        /Альфа|Демо|демонстрац|SMART CREDIT/,
      );
      await expect(page.locator(".current-application")).toBeVisible();
      await page.screenshot({
        path: "test-results/brand-" + theme + "-" + width + ".png",
        fullPage: true,
      });
    });
  }
}
test("клиентские разделы и помощник читают API", async ({ page }) => {
  await login(page);
  for (const route of [
    "products",
    "applications",
    "company",
    "documents",
    "news",
    "settings",
  ]) {
    await page.goto("/client/" + route);
    await expect(page.locator(".page-title")).toBeVisible();
  }
  await page.goto("/client/dashboard");
  await page.getByRole("button", { name: "Помощник", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".credit-ai__header")).not.toContainText("Демо");
});
test("роли разграничивают доступ", async ({ page }) => {
  await login(page, "platform_admin");
  await page.goto("/bank/administration/staff");
  await expect(
    page.getByRole("heading", { name: "Администрирование" }),
  ).toBeVisible();
  await expect(page.getByText("admin@example.test")).toBeVisible();
  await page.context().clearCookies();
  await login(page, "platform_officer");
  await page.goto("/bank/administration");
  await expect(page).toHaveURL(/bank\/applications$/);
});
test("мастер сохраняет и отправляет заявку", async ({ page }) => {
  await login(page);
  await page.goto("/client/applications/new");
  for (let step = 0; step < 3; step++) {
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  }
  await page
    .getByLabel(
      "Подтверждаю корректность данных и отправку заявки на рассмотрение",
    )
    .check();
  await page
    .getByRole("button", { name: "Отправить заявку", exact: true })
    .click();
  await expect(page).toHaveURL(/client\/applications\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.locator(".page-title")).toContainText("Заявка");
});

test("банкир одобряет исходную сумму и срок отдельной кнопкой", async ({ page }) => {
  await login(page, "platform_officer");
  await page.locator(".table-primary").first().click();
  await expect(page).toHaveURL(/bank\/applications\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const base = "http://127.0.0.1:8011/api/v1";
  const original = (await (await page.request.get(`${base}/bank/applications/${id}`)).json()).application;
  const catalog = await (await page.request.get(`${base}/catalog`)).json();
  const product = catalog.find((p: { id: string }) => p.id === original.requested_terms.product_id);
  const approve = page.getByRole("button", { name: "Одобрить на условиях клиента", exact: true });
  await expect(approve).toBeDisabled();
  await page.getByRole("button", { name: "Взять в работу", exact: true }).click();
  await expect(approve).toBeEnabled();
  await expect(page.getByRole("button", { name: "Предложить другие условия", exact: true })).toBeEnabled();
  await approve.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Сумма по заявке", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Предлагаемая сумма, ₽")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Проверить и подтвердить" }).click();
  const decision = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/bank/applications/${id}/decision`));
  await dialog.getByRole("button", { name: "Подтвердить решение" }).click();
  const response = await decision;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    type: "OFFERED",
    offered_amount: original.requested_terms.amount,
    offered_term_months: original.requested_terms.term_months,
    offered_annual_rate: String(product.annual_rate),
    reason: "Одобрено на условиях клиента.",
  });
  const saved = (await (await page.request.get(`${base}/bank/applications/${id}`)).json()).application;
  expect(saved.status).toBe("OFFERED");
  expect(saved.latest_offer.amount).toBe(original.requested_terms.amount);
  expect(saved.latest_offer.term_months).toBe(original.requested_terms.term_months);
  await page.context().clearCookies();
  await login(page, "platform_admin");
  await page.goto(`/bank/applications/${id}`);
  await expect(page.getByRole("button", { name: "Одобрить на условиях клиента", exact: true })).toHaveCount(0);
});

test("новый клиент не получает заявку до изменения формы", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => {
    if (["POST", "PATCH"].includes(request.method()) &&
        /\/api\/v1\/applications(?:\/[^/?]+)?$/.test(request.url()))
      writes.push(request.method());
  });
  await page.goto("/login");
  await page.getByLabel("Email или логин").fill("platform_new_client");
  await page.getByRole("textbox", { name: "Пароль", exact: true }).fill("Demo2026!");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/client\/onboarding$/);
  await page.getByLabel("Юридическое название").fill("Новая компания");
  await page.getByRole("textbox", { name: /^ИНН/ }).fill("7702000123");
  await page.getByRole("button", { name: "Завершить настройку" }).click();
  await expect(page.getByText("Ваша первая заявка", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ваша первая заявка", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);

  await page.goto("/client/applications/new");
  await expect(page.getByText("Черновик ещё не создан", { exact: true })).toBeVisible();
  // Observe longer than the 700 ms autosave debounce, including StrictMode mount.
  await page.waitForTimeout(1200);
  expect(writes).toEqual([]);
  await page.goto("/client/dashboard");
  await expect(page.getByText("Ваша первая заявка", { exact: true })).toBeVisible();

  await page.goto("/client/applications/new");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  const created = page.waitForResponse(r => r.request().method() === "POST" && /\/api\/v1\/applications$/.test(r.url()));
  await page.getByRole("textbox", { name: "Сумма кредита, ₽" }).fill("3200001");
  expect((await created).status()).toBe(201);
  await expect(page.locator(".save-state")).toContainText("Сохранено в");
  expect(writes).toEqual(["POST"]);

  await page.reload();
  await expect(page.getByText("Черновик сохранён", { exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(writes).toEqual(["POST"]);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  const updated = page.waitForResponse(r => r.request().method() === "PATCH" && /\/api\/v1\/applications\/[^/?]+$/.test(r.url()));
  await page.getByLabel("Комментарий", { exact: true }).fill("Изменение существующего черновика");
  expect((await updated).status()).toBe(200);
  expect(writes).toEqual(["POST", "PATCH"]);
});
