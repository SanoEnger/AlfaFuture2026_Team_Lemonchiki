import { test, expect } from "@playwright/test";
test("новые экраны: обе темы на 1440, 1280, 768 и 390",async({page})=>{
  test.setTimeout(120000);
  for(const theme of ["dark","light"]){
    await page.goto("/demo-login");
    await page.getByRole("textbox",{name:"Демо-сценарий"}).click();
    await page.getByRole("option",{name:"Администратор · демосценарий",exact:true}).click();
    await page.getByRole("button",{name:"Войти в кабинет"}).click();
    await expect(page.locator("main.content h1")).toBeVisible();
    if(await page.locator("html").getAttribute("data-mantine-color-scheme")!==theme) await page.locator(".theme-button").click();
    await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme",theme);
    await page.screenshot({path:`test-results/master-${theme}-administration.png`,fullPage:true});
    await page.getByRole("button",{name:"Выйти",exact:true}).click();
    for(const width of [1440,1280,768,390]){
      await page.setViewportSize({width,height:900});
      for(const route of ["login","register"]){
        await page.goto(`/${route}`);await page.evaluate(()=>document.fonts.ready);await expect(page.locator("h2")).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await expect(page.locator("html")).toHaveAttribute("data-mantine-color-scheme",theme);
        await page.screenshot({path:`test-results/master-${theme}-${route}-${width}.png`,fullPage:true});
      }
    }
    await page.setViewportSize({width:1280,height:900});
  }
});
