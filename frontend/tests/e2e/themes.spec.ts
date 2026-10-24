import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, bank = false) {
  await page.goto("/demo-login");
  if (bank) {
    await page.getByRole("textbox", { name: "Демо-сценарий" }).click();
    await page
      .getByRole("option", { name: "Сотрудник банка", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await expect(page.locator("main.content h1")).toBeVisible();
}
async function loaded(page: Page) {
  await expect(page.locator("main.content h1")).toBeVisible();
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}
async function theme(page: Page, value: "dark" | "light") {
  if (
    (await page.locator("html").getAttribute("data-mantine-color-scheme")) !==
    value
  ) {
    await page.locator(".theme-button").click();
  }
  await expect(page.locator("html")).toHaveAttribute(
    "data-mantine-color-scheme",
    value,
  );
}
async function geometry(page: Page) {
  return page.locator("main.content").evaluate((el) =>
    [
      el,
      ...el.querySelectorAll(
        ".panel, .page-title, .metrics, .mantine-Button-root, .mantine-Input-input",
      ),
    ].map((node) => {
      const r = node.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map((n) => Math.round(n));
    }),
  );
}

test("новые темы сохраняют геометрию всех экранов клиента", async ({
  page,
}) => {
  test.setTimeout(120000);
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
    await loaded(page);
    await theme(page, "dark");
    expect(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain("IBM Plex Sans");
    expect(
      await page.evaluate(() => document.fonts.check('14px "IBM Plex Sans"')),
    ).toBe(true);
    const dark = await geometry(page);
    await page.screenshot({
      path: `test-results/glow-${route.replaceAll("/", "-")}.png`,
      fullPage: true,
    });
    await theme(page, "light");
    expect(await geometry(page)).toEqual(dark);
    await page.screenshot({
      path: `test-results/pearl-${route.replaceAll("/", "-")}.png`,
      fullPage: true,
    });
  }
  await page.goto("/client/dashboard");
  await loaded(page);
  expect(
    await page
      .locator(".page-title .mantine-Button-root")
      .evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain("linear-gradient");
  expect(
    await page
      .locator(".current-application")
      .evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain("linear-gradient");
  expect(
    await page
      .locator(".product-card")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toBe("none");
  await page.goto("/client/settings");
  await page.getByRole("button", { name: "Системная", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-mantine-color-scheme",
    "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-mantine-color-scheme",
    "light",
  );
});

test("темы банка, вкладки и формы решений", async ({ page }) => {
  test.setTimeout(90000);
  await login(page, true);
  for (const route of [
    "applications",
    ...["data", "risk", "documents", "history"].map(
      (tab) => `applications/SC-1042?tab=${tab}`,
    ),
    "settings",
  ]) {
    await page.goto(`/bank/${route}`);
    await loaded(page);
    await theme(page, "dark");
    const dark = await geometry(page);
    await page.screenshot({
      path: `test-results/glow-bank-${route.replaceAll(/[/?=]/g, "-")}.png`,
      fullPage: true,
    });
    await theme(page, "light");
    expect(await geometry(page)).toEqual(dark);
    await page.screenshot({
      path: `test-results/pearl-bank-${route.replaceAll(/[/?=]/g, "-")}.png`,
      fullPage: true,
    });
  }
  await page.goto("/bank/applications/SC-1042");
  await loaded(page);
  for (const name of ["Предложить условия", "Запросить сведения", "Отказать"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: `test-results/pearl-bank-action-${name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Отмена", exact: true }).click();
  }
});

test("1440, 1280, 768 и 390: адаптивность, AI и сводка мастера", async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const value of ["dark", "light"] as const) {
      for (const route of [
        "dashboard",
        "applications",
        "applications/new",
        "applications/SC-1038",
      ]) {
        await page.goto(`/client/${route}`);
        await loaded(page);
        await theme(page, value);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (route === "applications/new" && width <= 768) {
          const details = page.locator(".wizard-summary");
          await expect(details).not.toHaveAttribute("open", "");
          await page.locator(".wizard-summary-toggle").click();
          await expect(details).toHaveAttribute("open", "");
        }
      }
      await page
        .getByRole("button", { name: "Объяснить условия", exact: true })
        .click();
      const drawer = page.locator(".credit-assistant .mantine-Drawer-content");
      await expect(drawer).toBeVisible();
      const drawerBox = await drawer.boundingBox();
      if (width >= 1280) {
        const workspace = await page.locator(".workspace").boundingBox();
        expect(workspace!.x + workspace!.width).toBeLessThanOrEqual(
          drawerBox!.x + 1,
        );
        await expect(
          page.getByRole("button", {
            name: "Принять предложение",
            exact: true,
          }),
        ).toBeEnabled();
      } else if (width <= 768) expect(Math.round(drawerBox!.width)).toBe(width);
      await page
        .getByRole("button", {
          name: "Сравнить условия",
          exact: true,
        })
        .click();
      await expect(page.locator(".credit-ai__response").last()).toContainText(
        "Запрошенные сумма и срок",
      );
      await page.screenshot({
        path: `test-results/${value}-assistant-${width}.png`,
        fullPage: true,
      });
      await drawer.getByRole("button", { name: "Закрыть помощника" }).click();
      await expect(drawer).not.toBeVisible();
    }
  }
});
