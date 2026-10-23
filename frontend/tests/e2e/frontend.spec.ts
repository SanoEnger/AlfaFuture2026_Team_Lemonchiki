import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, role = "Предприниматель · ООО «Вектор»") {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Демо-сценарий" }).click();
  await page.getByRole("option", { name: role, exact: true }).click();
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
}
async function switchRole(page: Page, role: string) {
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await login(page, role);
}
test("весь путь: мастер → уточнение → оффер → завершение", async ({ page }) => {
  await login(page);
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
  const url = page.url();
  const id = url.split("/").at(-1)!;
  await expect(
    page.getByText("На рассмотрении", { exact: true }).first(),
  ).toBeVisible();
  await switchRole(page, "Сотрудник банка");
  await page.goto(`/bank/applications/${id}`);
  await page
    .getByRole("button", { name: "Запросить сведения", exact: true })
    .click();
  await page.getByLabel("Какие сведения нужны").fill("Приложите выписку");
  await page.getByRole("button", { name: "Проверить и подтвердить" }).click();
  await page.getByRole("button", { name: "Подтвердить решение" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await switchRole(page, "Предприниматель · ООО «Вектор»");
  await page.goto(`/client/applications/${id}`);
  await expect(
    page.getByText("Приложите выписку", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Ваш ответ банку").fill("Данные уточнены");
  await page.getByRole("button", { name: "Отправить уточнения" }).click();
  await expect(
    page.getByText("На рассмотрении", { exact: true }).first(),
  ).toBeVisible();
  await switchRole(page, "Сотрудник банка");
  await page.goto(`/bank/applications/${id}`);
  await page
    .getByRole("button", { name: "Предложить условия", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Предлагаемая сумма, ₽" })
    .fill("350000");
  await page
    .getByLabel("Комментарий к предложению")
    .fill("Сумма скорректирована");
  await page.getByRole("button", { name: "Проверить и подтвердить" }).click();
  await page.getByRole("button", { name: "Подтвердить решение" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await switchRole(page, "Предприниматель · ООО «Вектор»");
  await page.goto(`/client/applications/${id}`);
  await expect(page.getByRole("cell", { name: "350 000 ₽" })).toBeVisible();
  await page.getByRole("button", { name: "Принять предложение" }).click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(
    page.getByText("Оформление завершено", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Оформление завершено", { exact: true }),
  ).toBeVisible();
});
test("экраны, темы, мобильная ширина и отсутствие запросов к API", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (r) => {
    if (["fetch", "xhr"].includes(r.resourceType())) apiRequests.push(r.url());
  });
  await login(page);
  for (const route of [
    "dashboard",
    "applications",
    "products",
    "applications/new",
    "applications/SC-1042",
    "applications/SC-1035",
    "applications/SC-1038",
    "company",
    "documents",
    "news",
    "settings",
    "ui-states",
  ]) {
    await page.goto(`/client/${route}`);
    await expect(page.locator("main.content h1")).toBeVisible();
    await expect(page.locator(".loading")).toHaveCount(0);
    await page.screenshot({
      path: `test-results/dark-${route.replaceAll("/", "-")}.png`,
      fullPage: true,
    });
  }
  await page.goto('/client/settings');
  await page.getByRole("button", { name: "Светлая", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-mantine-color-scheme",
    "light",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-mantine-color-scheme",
    "light",
  );
  await page.goto("/client/dashboard");
  await page.screenshot({
    path: "test-results/light-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "dashboard",
    "applications",
    "applications/new",
    "applications/SC-1038",
    "settings",
  ]) {
    await page.goto(`/client/${route}`);
    await expect(page.locator(".loading")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/mobile-${route.replaceAll("/", "-")}.png`,
      fullPage: true,
    });
  }
  expect(apiRequests).toEqual([]);
});
test("guard ролей, банк и обработка неизвестной заявки", async ({ page }) => {
  await login(page);
  await page.goto("/bank/applications");
  await expect(page).toHaveURL(/client\/dashboard/);
  await switchRole(page, "Сотрудник банка");
  await page.goto("/client/company");
  await expect(page).toHaveURL(/bank\/applications/);
  await page.goto("/bank/applications/SC-1042?tab=risk");
  await expect(page.getByText("Факторы оценки", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/bank-risk.png", fullPage: true });
  for (const tab of ["data", "documents", "history"]) {
    await page.goto(`/bank/applications/SC-1042?tab=${tab}`);
    await expect(page.locator(".loading")).toHaveCount(0);
    await page.screenshot({
      path: `test-results/bank-${tab}.png`,
      fullPage: true,
    });
  }
  await page.goto("/bank/applications/unknown");
  await expect(
    page.getByText("Заявка не найдена", { exact: true }),
  ).toBeVisible();
});
