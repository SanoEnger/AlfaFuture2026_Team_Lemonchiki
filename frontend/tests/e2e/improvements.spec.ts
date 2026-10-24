import { test, expect } from "@playwright/test";
test("автосохранение восстанавливает один черновик и последние значения", async ({
  page,
}) => {
  await page.goto("/demo-login");
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await page.goto("/client/applications/new");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Сумма кредита, ₽", exact: true })
    .fill("777777.25");
  await expect(page.locator(".save-state")).toContainText("Сохранено в");
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("smart-credit-form-client_good-new")!),
  );
  expect(before.id).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Сумма кредита, ₽", exact: true }),
  ).toHaveValue("777 777.25");
  await expect(page.locator(".save-state")).toContainText("Сохранено в");
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("smart-credit-form-client_good-new")!),
  );
  expect(after.id).toBe(before.id);
  const matches = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem("smart-credit-demo-v1")!).filter(
        (a: { id: string }) => a.id === id,
      ).length,
    before.id,
  );
  expect(matches).toBe(1);
});
test("PDF остаётся связан с запросом до явного ответа, вопросы сворачиваются", async ({
  page,
}) => {
  await page.goto("/demo-login");
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await page.goto("/client/applications/SC-1035");
  await page
    .locator('input[type="file"]')
    .setInputFiles("tests/fixtures/statement.pdf");
  await expect(
    page.getByRole("status").filter({ hasText: "Документ добавлен" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("smart-credit-demo-v1")!).find(
          (a: { id: string }) => a.id === "SC-1035",
        ).information_requests[0].status,
    ),
  ).toBe("OPEN");
  await page
    .getByRole("button", { name: "Открыть помощника", exact: true })
    .click();
  await page.locator(".credit-ai__shortcut").first().click();
  await expect(page.locator(".credit-ai__response")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Популярные вопросы/ }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /Популярные вопросы/ }).click();
  await expect(page.locator(".credit-ai__shortcut").first()).toBeVisible();
});
