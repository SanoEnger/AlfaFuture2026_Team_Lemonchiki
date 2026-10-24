import { test, expect, type Page } from "@playwright/test";
async function demoLogin(page: Page, role: string) {
  await page.goto("/demo-login");
  await page.getByRole("textbox", { name: "Демо-сценарий" }).click();
  await page.getByRole("option", { name: role, exact: true }).click();
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await expect(page.locator("main.content h1")).toBeVisible();
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
}
test("регистрация → подтверждение → компания → заявка → восстановление пароля", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/register");
  await page.getByLabel("Имя").fill("Анна Тестовая");
  await page.getByLabel("Email").fill("anna@example.test");
  await page.getByLabel("Новый пароль").fill("ClientTest123");
  await page.getByLabel("Повторите пароль").fill("ClientTest123");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(
    page.getByRole("heading", { name: "Проверьте демонстрационную почту" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Демонстрационная почта", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Открыть письмо: Подтверждение email" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Подтвердить email", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Email подтверждён" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Перейти ко входу" }).click();
  await page.getByLabel("Email").fill("anna@example.test");
  await page.getByLabel("Пароль").fill("ClientTest123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/client\/onboarding/);
  await page.getByLabel("Юридическое название").fill("ООО Тестовый бизнес");
  await page.getByLabel("ИНН").fill("1234567890");
  await page.getByRole("button", { name: "Завершить настройку" }).click();
  await expect(page).toHaveURL(/client\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Ваша первая заявка" }),
  ).toBeVisible();
  await page.goto("/bank/administration");
  await expect(page).toHaveURL(/client\/dashboard/);
  await page.goto("/client/applications/new");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Отправить заявку", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /Заявка №/ })).toBeVisible();
  await logout(page);
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("anna@example.test");
  await page.getByRole("button", { name: "Получить инструкцию" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Если аккаунт существует, инструкция подготовлена",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Демонстрационная почта", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Открыть письмо: Восстановление пароля" })
    .first()
    .click();
  await page.getByLabel("Новый пароль").fill("ChangedTest123");
  await page.getByLabel("Повторите пароль").fill("ChangedTest123");
  await page.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(
    page.getByRole("heading", { name: "Пароль изменён" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Перейти ко входу" }).click();
  await page.getByLabel("Email").fill("anna@example.test");
  await page.getByLabel("Пароль").fill("ChangedTest123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/client\/dashboard/);
});
test("администратор → приглашение → сотрудник → назначение → блокировка", async ({
  page,
}) => {
  test.setTimeout(60000);
  await demoLogin(page, "Администратор · демосценарий");
  await expect(page).toHaveURL(/bank\/administration/);
  await page
    .getByRole("button", { name: "Пригласить сотрудника", exact: true })
    .click();
  await page.getByLabel("Email сотрудника").fill("officer@example.test");
  await page.getByRole("button", { name: "Создать приглашение" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/bank/applications/SC-1041");
  await expect(
    page.getByRole("button", { name: "Предложить условия", exact: true }),
  ).toHaveCount(0);
  await logout(page);
  await page.goto("/demo-mailbox");
  await page
    .getByRole("link", { name: "Открыть письмо: Приглашение сотрудника" })
    .first()
    .click();
  await expect(
    page.getByText("Приглашение для officer@example.test"),
  ).toBeVisible();
  await page.getByLabel("Имя").fill("Мария Сотрудник");
  await page.getByLabel("Новый пароль").fill("OfficerTest123");
  await page.getByLabel("Повторите пароль").fill("OfficerTest123");
  await page.getByRole("button", { name: "Активировать аккаунт" }).click();
  await page.getByRole("link", { name: "Перейти ко входу" }).click();
  await page.getByLabel("Email").fill("officer@example.test");
  await page.getByLabel("Пароль").fill("OfficerTest123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/bank\/applications/);
  await page.goto("/bank/administration");
  await expect(page).toHaveURL(/bank\/applications/);
  await page.goto("/bank/applications/SC-1041");
  await expect(
    page.getByRole("button", { name: "Предложить условия", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Взять в работу" }).click();
  await expect(
    page.getByRole("button", { name: "Предложить условия", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".bank-decision-bar")).toContainText(
    "Мария Сотрудник",
  );
  await logout(page);
  await demoLogin(page, "Администратор · демосценарий");
  await page
    .getByRole("button", { name: "Заблокировать", exact: true })
    .click();
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Восстановить", exact: true }),
  ).toBeVisible();
  await page.goto("/bank/administration/audit");
  await expect(
    page.getByText("Доступ заблокирован", { exact: true }),
  ).toBeVisible();
});
test("публичные страницы адаптивны и без выбора банковской роли во входе", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "login",
    "register",
    "verify-email",
    "forgot-password",
    "reset-password",
    "accept-invitation",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator("h2")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Демо-сценарий")).toHaveCount(0);
  }
});
