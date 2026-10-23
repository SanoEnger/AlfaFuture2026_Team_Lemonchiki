import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, bank = false) {
  await page.goto("/login");
  if (bank) {
    await page.getByRole("textbox", { name: "Демо-сценарий" }).click();
    await page
      .getByRole("option", { name: "Сотрудник банка", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await expect(page.locator("main.content h1")).toBeVisible();
  await expect(page.locator(".loading")).toHaveCount(0);
}
async function width(page: Page, value: number) {
  await expect
    .poll(async () =>
      Math.round(
        (await page.locator("aside.expandable-sidebar").boundingBox())!.width,
      ),
    )
    .toBe(value);
}
const workspaceX = (page: Page) =>
  page
    .locator(".workspace")
    .evaluate((el) => Math.round(el.getBoundingClientRect().x));

test("hover без сдвига, закрепление, сохранение и обе темы", async ({
  page,
}) => {
  await login(page);
  const rail = page.locator("aside.expandable-sidebar");
  await width(page, 68);
  expect(await workspaceX(page)).toBe(68);
  for (const theme of ["dark", "light"]) {
    if (
      (await page.locator("html").getAttribute("data-mantine-color-scheme")) !==
      theme
    )
      await page.locator(".theme-button").click();
    await page.mouse.move(600, 80);
    await width(page, 68);
    const content = await page.locator("main.content").boundingBox();
    await rail.hover();
    await width(page, 224);
    await expect(rail.locator(".rail-wordmark")).toHaveCSS("opacity", "1");
    expect(await workspaceX(page)).toBe(68);
    expect(await page.locator("main.content").boundingBox()).toEqual(content);
    const active = rail.locator('[aria-current="page"]');
    await expect(active).toHaveCount(1);
    expect(
      await active.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(theme === "dark" ? "rgb(42, 48, 55)" : "rgb(233, 237, 241)");
    await page.screenshot({
      path: `test-results/sidebar-${theme}-hover.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Закрепить меню", exact: true })
      .click();
    await page.mouse.move(700, 80);
    await width(page, 224);
    expect(await workspaceX(page)).toBe(224);
    await page.reload();
    await expect(page.locator("main.content h1")).toBeVisible();
    await width(page, 224);
    expect(await workspaceX(page)).toBe(224);
    await page
      .getByRole("button", { name: "Открепить меню", exact: true })
      .click();
    await width(page, 224);
    await page.mouse.move(700, 80);
    await width(page, 68);
    expect(await workspaceX(page)).toBe(68);
    await page.screenshot({
      path: `test-results/sidebar-${theme}-collapsed.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});
test("Tab, Enter, Space, Escape и reduced motion", async ({ page }) => {
  await login(page);
  await page.goto("/client/dashboard");
  await page.mouse.move(600, 80);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Закрепить меню", exact: true }),
  ).toBeFocused();
  await width(page, 224);
  expect(await workspaceX(page)).toBe(68);
  await page.keyboard.press("Escape");
  await width(page, 68);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Главная", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/client\/applications$/);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/client\/applications\/new$/);
  await page
    .getByRole("button", { name: "Закрепить меню", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Открепить меню" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await width(page, 224);
  await page.getByRole("button", { name: "Открепить меню" }).press("Enter");
  await page.locator(".theme-button").focus();
  await page.mouse.move(600, 80);
  await width(page, 68);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator("aside.expandable-sidebar")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});
test("пункты клиента и представления банка", async ({ page }) => {
  await login(page);
  const rail = page.locator("aside.expandable-sidebar");
  for (const [name, path] of [
    ["Главная", "dashboard"],
    ["Мои заявки", "applications"],
    ["Новая заявка", "applications/new"],
    ["Продукты", "products"],
    ["Моя компания", "company"],
    ["Документы", "documents"],
    ["Новости", "news"],
    ["Настройки", "settings"],
  ]) {
    await rail.hover();
    await width(page, 224);
    await rail.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/client/${path}$`));
    await expect(rail.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(rail.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await login(page, true);
  for (const name of [
    "Очередь заявок",
    "Рассмотрение",
    "История решений",
    "Настройки",
  ]) {
    await rail.hover();
    await width(page, 224);
    await rail.getByRole("link", { name, exact: true }).click();
    await expect(page.locator("main.content h1")).toHaveText(name==='Настройки'?'Настройки оформления':name);
    await expect(rail.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator(".loading")).toHaveCount(0);
    if (name === "Рассмотрение") {
      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(2);
      for (const row of await rows.all())
        await expect(row.locator(".status")).toHaveText("На рассмотрении");
    }
    if (name === "История решений") {
      await expect(page.locator("tbody tr")).toHaveCount(3);
      await expect(page.locator("tbody .status-UNDER_REVIEW")).toHaveCount(0);
      await expect(page.locator("tbody .status-DRAFT")).toHaveCount(0);
    }
  }
});
test.describe("телефон", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("выбор пункта, backdrop, Escape и обе темы", async ({ page }) => {
    await login(page);
    await expect(page.locator("aside.expandable-sidebar")).toHaveCount(0);
    expect(await workspaceX(page)).toBe(0);
    for (const theme of ["dark", "light"]) {
      if (
        (await page
          .locator("html")
          .getAttribute("data-mantine-color-scheme")) !== theme
      )
        await page.locator(".theme-button").click();
      await page
        .getByRole("button", { name: "Открыть меню", exact: true })
        .tap();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.screenshot({
        path: `test-results/sidebar-mobile-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await dialog.getByRole("link", { name: "Продукты", exact: true }).tap();
      await expect(page).toHaveURL(/client\/products$/);
      await expect(dialog).not.toBeVisible();
      await page
        .getByRole("button", { name: "Открыть меню", exact: true })
        .tap();
      await page
        .locator(".sidebar-mobile-drawer .mantine-Drawer-overlay")
        .tap({ position: { x: 350, y: 300 } });
      await expect(dialog).not.toBeVisible();
      await page
        .getByRole("button", { name: "Открыть меню", exact: true })
        .tap();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
});
test.describe("сенсорный планшет", () => {
  test.use({ viewport: { width: 1024, height: 800 }, hasTouch: true });
  test("нажатие вместо hover и закрытие вне панели", async ({ page }) => {
    await login(page);
    await width(page, 68);
    await page.getByRole("button", { name: "Открыть меню", exact: true }).tap();
    await width(page, 224);
    expect(await workspaceX(page)).toBe(68);
    await expect(page.locator(".sidebar-backdrop")).toBeVisible();
    await page
      .getByRole("button", { name: "Закрыть меню нажатием вне панели" })
      .tap({ position: { x: 700, y: 300 } });
    await width(page, 68);
    await page.getByRole("link", { name: "Новости", exact: true }).tap();
    await width(page, 224);
    await expect(page).toHaveURL(/client\/dashboard$/);
    await page.getByRole("link", { name: "Новости", exact: true }).tap();
    await expect(page).toHaveURL(/client\/news$/);
    await width(page, 68);
  });
});
