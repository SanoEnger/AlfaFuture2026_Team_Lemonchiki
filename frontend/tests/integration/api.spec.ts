import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, user: string) {
  await page.goto("/server-login");
  await page.getByLabel("Логин сервера").fill(user);
  await page.getByLabel("Пароль сервера").fill("Demo2026!");
  await page.getByRole("button", { name: "Войти через API" }).click();
  await expect(page.locator("main.content h1")).toBeVisible();
  await expect(page.locator(".demo-label")).toContainText("сервер");
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
}
test("реальный HTTP: заявка → запрос → PDF → оффер → принятие → явное завершение", async ({
  page,
}) => {
  await login(page, "client_good");
  await page.goto("/client/applications/new");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Сумма кредита, ₽", exact: true })
    .fill("400000");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Отправить заявку", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /Заявка №/ })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(
    await page.evaluate(() => localStorage.getItem("smart-credit-demo-v1")),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("smart-credit-form-")),
    ),
  ).toBe(false);
  await logout(page);
  await login(page, "banker");
  await page.goto(`/bank/applications/${id}`);
  await page
    .getByRole("button", { name: "Запросить сведения", exact: true })
    .click();
  await page
    .getByLabel("Какие сведения нужны")
    .fill("Приложите синтетический PDF");
  await page.getByRole("button", { name: "Проверить и подтвердить" }).click();
  await page.getByRole("button", { name: "Подтвердить решение" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await logout(page);
  await login(page, "client_good");
  await page.goto(`/client/applications/${id}`);
  await page
    .locator('input[type="file"]')
    .setInputFiles("tests/fixtures/statement.pdf");
  await expect(
    page.getByText("Документ добавлен", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Скачать statement.pdf" }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать statement.pdf" }).click();
  expect((await downloading).suggestedFilename()).toBe("statement.pdf");
  await page.getByRole("button", { name: "Отправить уточнения" }).click();
  await expect(
    page.getByText("На рассмотрении", { exact: true }).first(),
  ).toBeVisible();
  await logout(page);
  await login(page, "banker");
  await page.goto(`/bank/applications/${id}`);
  await page
    .getByRole("button", { name: "Предложить условия", exact: true })
    .click();
  await page.getByLabel("Предлагаемая сумма, ₽").fill("350000");
  await page
    .getByLabel("Комментарий к предложению")
    .fill("Демонстрационное предложение");
  await page.getByRole("button", { name: "Проверить и подтвердить" }).click();
  await page.getByRole("button", { name: "Подтвердить решение" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await logout(page);
  await login(page, "client_good");
  await page.goto(`/client/applications/${id}`);
  await page
    .getByRole("button", { name: "Принять предложение", exact: true })
    .click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Завершить демосценарий" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Завершить демосценарий" }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(
    page.getByText("Оформление завершено", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Оформление завершено", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "400 000 ₽", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть помощника", exact: true })
    .click();
  await page.locator(".credit-ai__shortcut").first().click();
  await expect(page.locator(".credit-ai__response")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Помощник", exact: true }),
  ).not.toBeVisible();
  await page.screenshot({
    path: "test-results-api/completed-http-workflow.png",
    fullPage: true,
  });
});
test("серверная ошибка входа и чужая заявка не подменяются локальными данными", async ({
  page,
  request,
}) => {
  await page.goto("/server-login");
  await page.getByLabel("Логин сервера").fill("client_good");
  await page.getByLabel("Пароль сервера").fill("wrong-demo-password");
  await page.getByRole("button", { name: "Войти через API" }).click();
  await expect(page.getByRole("alert").last()).toContainText(
    "Неверный логин или пароль",
  );
  const reply = await request.post(
    "http://127.0.0.1:8011/api/v1/auth/demo-login",
    { data: { username: "client_good", password: "Demo2026!" } },
  );
  const auth = { Authorization: `Bearer ${(await reply.json()).access_token}` };
  const catalog = await request.get("http://127.0.0.1:8011/api/v1/products", {
    headers: auth,
  });
  const product = (await catalog.json())[0];
  const created = await request.post(
    "http://127.0.0.1:8011/api/v1/applications",
    {
      headers: auth,
      data: {
        product_id: product.id,
        amount: "400000",
        term_months: 24,
        purpose: product.purpose,
      },
    },
  );
  expect(created.ok()).toBe(true);
  const id = (await created.json()).id;
  await login(page, "client_risky");
  await page.goto(`/client/applications/${id}`);
  await expect(
    page.getByText("Заявка не найдена", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("smart-credit-demo-v1")),
  ).toBeNull();
});
