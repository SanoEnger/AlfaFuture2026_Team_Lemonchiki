import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/demo-login");
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await expect(page.locator("main.content h1")).toBeVisible();
}
async function open(page: Page) {
  await page
    .getByRole("button", { name: "Открыть помощника", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Помощник", exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Отправить вопрос" }),
  ).toBeVisible();
  await expect(dialog.locator(".credit-ai__context-title")).not.toHaveText(
    "Загружаем контекст…",
  );
  await expect
    .poll(async () => {
      const r = await dialog.boundingBox();
      return Math.round(r!.x + r!.width);
    })
    .toBe(page.viewportSize()!.width);
  return dialog;
}
async function ask(page: Page, question: string) {
  const n = await page.locator(".credit-ai__response").count();
  await page.locator(".credit-ai__textarea").fill(question);
  await page.locator(".credit-ai__textarea").press("Enter");
  await expect(page.locator(".credit-ai__response")).toHaveCount(n + 1);
}
async function application(page: Page, id: string) {
  await page.goto(`/client/applications/${id}`);
  await expect(page.locator(".loading")).toHaveCount(0);
  await expect(page.locator("main.content h1")).toContainText(id.slice(3));
}
async function viaList(page: Page, id: string) {
  await page.locator("aside.expandable-sidebar").hover();
  await page
    .locator("aside")
    .getByRole("link", { name: "Мои заявки", exact: true })
    .click();
  await page.mouse.move(500, 80);
  await expect(page.locator("aside.expandable-sidebar")).toHaveAttribute(
    "data-expanded",
    "false",
  );
  await page
    .locator("main")
    .getByRole("link", { name: `№${id.slice(3)}`, exact: true })
    .click();
  await expect(page.locator(".credit-ai__context-title")).toContainText(
    id.slice(3),
  );
}

test("актуальный контекст, источники и отдельная история каждой заявки", async ({
  page,
}) => {
  await login(page);
  await application(page, "SC-1042");
  await open(page);
  await expect(page.locator(".credit-ai__shortcut")).toHaveCount(3);
  await expect(page.locator(".credit-ai__context")).toContainText("3 200 000");
  await page
    .getByRole("button", { name: "Что со статусом?", exact: true })
    .click();
  await expect(page.locator(".credit-ai__response")).toContainText(
    "Заявка №1042",
  );
  await expect(page.locator(".credit-ai__source-link")).toHaveAttribute(
    "href",
    "/client/applications/SC-1042#history",
  );
  await viaList(page, "SC-1038");
  await expect(page.locator(".credit-ai__empty")).toBeVisible();
  await expect(page.locator(".credit-ai__response")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Сравнить условия", exact: true })
    .click();
  await expect(page.locator(".credit-ai__response")).toContainText("1 500 000");
  await expect(page.locator(".credit-ai__response")).not.toContainText("1042");
  await viaList(page, "SC-1042");
  await expect(page.locator(".credit-ai__response")).toHaveCount(1);
  await expect(page.locator(".credit-ai__response")).toContainText(
    "Заявка №1042",
  );
  await page
    .locator(".credit-ai__actions")
    .getByRole("link", { name: "Открыть историю" })
    .click();
  await expect(page).toHaveURL(/SC-1042#history$/);
  await expect(page.locator("#history")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("smart-credit-demo-v1")!).find(
          (a: { id: string }) => a.id === "SC-1042",
        ).status,
    ),
  ).toBe("UNDER_REVIEW");
});

test("выбранные документы и продукт поступают из состояния страницы", async ({
  page,
}) => {
  await login(page);
  await page.goto("/client/documents?application=SC-1035");
  await expect(page.locator(".loading")).toHaveCount(0);
  await open(page);
  await expect(page.locator(".credit-ai__context-title")).toContainText("1035");
  await page
    .getByRole("button", { name: "Что нужно загрузить?", exact: true })
    .click();
  await expect(page.locator(".credit-ai__response")).toContainText(
    "Приложите выписку по расчётному счёту",
  );
  await page
    .locator("main")
    .getByRole("textbox", { name: "Заявка", exact: true })
    .click();
  await page.getByRole("option", { name: "№1042 · ООО «Вектор»" }).click();
  await expect(page.locator(".credit-ai__context-title")).toContainText("1042");
  await expect(page.locator(".credit-ai__response")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Что нужно загрузить?", exact: true })
    .click();
  await expect(page.locator(".credit-ai__response")).toContainText(
    "Бухгалтерская_отчётность.pdf",
  );
  await page.getByRole("button", { name: "Закрыть помощника" }).click();
  await page.goto("/client/products");
  await expect(page.locator(".loading")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Подробнее об условиях" })
    .last()
    .click();
  await page.getByRole("button", { name: "Объяснить продукт" }).click();
  await expect(
    page.getByRole("dialog", { name: "Помощник", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".credit-ai__context-title")).toHaveText(
    "Инвестиционный кредит",
  );
  await page
    .getByRole("button", { name: "Как выбрать кредит?", exact: true })
    .click();
  await expect(page.locator(".credit-ai__response")).toContainText(
    "Инвестиционный кредит",
  );
  await expect(page.locator(".credit-ai__response")).not.toContainText(
    "Оборотный кредит:",
  );
});

test("ошибка локального сервиса, повтор, пустой ввод, переносы и офлайн", async ({
  page,
  context,
}) => {
  await login(page);
  await application(page, "SC-1042");
  await open(page);
  await expect(
    page.getByRole("button", { name: "Отправить вопрос" }),
  ).toBeDisabled();
  await page.locator(".credit-ai__textarea").fill("   ");
  await expect(
    page.getByRole("button", { name: "Отправить вопрос" }),
  ).toBeDisabled();
  await page.evaluate(() => {
    sessionStorage.setItem(
      "assistant-test-backup",
      localStorage.getItem("smart-credit-demo-v1")!,
    );
    localStorage.setItem("smart-credit-demo-v1", "{broken");
  });
  await page
    .getByRole("button", { name: "Что со статусом?", exact: true })
    .click();
  await expect(page.locator(".credit-ai__error")).toContainText(
    "Не удалось прочитать локальные демоданные",
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "smart-credit-demo-v1",
      sessionStorage.getItem("assistant-test-backup")!,
    ),
  );
  await page
    .getByRole("button", { name: "Повторить запрос", exact: true })
    .click();
  await expect(page.locator(".credit-ai__response")).toContainText(
    "Заявка №1042",
  );
  await expect(page.locator(".credit-ai__message--user")).toHaveCount(1);
  const input = page.locator(".credit-ai__textarea");
  await input.fill("Что");
  await input.press("Shift+Enter");
  await input.pressSequentially("дальше?");
  await expect(input).toHaveValue("Что\nдальше?");
  await input.press("Enter");
  await expect(page.locator(".credit-ai__response")).toHaveCount(2);
  await context.setOffline(true);
  await ask(page, "Что со статусом?");
  await expect(page.locator(".credit-ai__response").last()).toContainText(
    "На рассмотрении",
  );
  await context.setOffline(false);
});

test("недоступная заявка не раскрывает чужой контекст", async ({ page }) => {
  await login(page);
  await page.goto("/client/applications/SC-1041");
  await expect(
    page.getByText("Заявка не найдена", { exact: true }),
  ).toBeVisible();
  await open(page);
  await expect(page.locator(".credit-ai__context")).toContainText(
    "Контекст недоступен",
  );
  await expect(
    page.getByRole("button", { name: "Отправить вопрос" }),
  ).toBeDisabled();
  await expect(page.locator(".credit-ai")).not.toContainText("ИП Сервис");
});

test("420/580, две темы, независимый скролл и фокус на четырёх ширинах", async ({
  page,
}) => {
  test.setTimeout(150000);
  await login(page);
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await application(page, "SC-1038");
    for (const theme of ["dark", "light"]) {
      if (
        (await page
          .locator("html")
          .getAttribute("data-mantine-color-scheme")) !== theme
      )
        await page.locator(".theme-button").click();
      const opener = page.getByRole("button", {
        name: "Открыть помощника",
        exact: true,
      });
      const dialog = await open(page);
      await expect
        .poll(async () => Math.round((await dialog.boundingBox())!.width))
        .toBe(width <= 768 ? width : 420);
      if (width === 1440) {
        await page.getByRole("button", { name: "Расширить панель" }).click();
        await expect
          .poll(async () => Math.round((await dialog.boundingBox())!.width))
          .toBe(580);
        await page.getByRole("button", { name: "Сузить панель" }).click();
      } else
        await expect(
          page.getByRole("button", { name: "Расширить панель" }),
        ).toHaveCount(0);
      const header = await dialog.locator(".credit-ai__header").boundingBox();
      const composer = await dialog
        .locator(".credit-ai__composer")
        .boundingBox();
      const context = await dialog.locator(".credit-ai__context").boundingBox();
      for (let i = 0; i < 3; i++) await ask(page, "Сравнить условия");
      const region = dialog.locator(".credit-ai__messages");
      expect(
        await region.evaluate((el) => el.scrollHeight > el.clientHeight),
      ).toBe(true);
      await region.evaluate((el) => (el.scrollTop = 0));
      expect(await dialog.locator(".credit-ai__header").boundingBox()).toEqual(
        header,
      );
      expect(
        await dialog.locator(".credit-ai__composer").boundingBox(),
      ).toEqual(composer);
      expect(await dialog.locator(".credit-ai__context").boundingBox()).toEqual(
        context,
      );
      expect(composer!.y + composer!.height).toBeLessThanOrEqual(901);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await dialog
          .locator(".credit-ai__response")
          .first()
          .evaluate((el) => getComputedStyle(el).fontSize),
      ).toBe("14px");
      await dialog.screenshot({
        path: `test-results/assistant2-${theme}-${width}.png`,
        animations: "disabled",
      });
      await dialog.locator(".credit-ai__textarea").focus();
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
        ).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(opener).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 390, height: 420 });
  const dialog = await open(page);
  const composer = await dialog.locator(".credit-ai__composer").boundingBox();
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(421);
  await dialog.screenshot({
    path: "test-results/assistant2-short-viewport.png",
    animations: "disabled",
  });
});
