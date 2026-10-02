import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const fixturePath = process.env.SHOPCRAFT_EDITOR_FIXTURE_FILE;
test("merchant edits three themes, persists a draft and publishes only saved changes", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    !fixturePath || testInfo.project.name !== "desktop",
    "Requires an isolated editor fixture; desktop test also checks a phone viewport.",
  );
  test.setTimeout(480000);
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const fixture = JSON.parse(readFileSync(fixturePath!, "utf8")) as {
    email: string;
    password: string;
    storeId: string;
    slug: string;
  };
  const designPath = `/dashboard/stores/${fixture.storeId}/design`;
  const publicPath = `/shop/${fixture.slug}`;
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByLabel("Пароль", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 120000 });
  await page.goto(designPath, { timeout: 120000 });
  const preview = page.getByTestId("storefront-preview");
  await expect(preview.locator(".sf-minimal")).toBeVisible();
  await page
    .locator(".theme-option")
    .filter({ has: page.getByText("Street", { exact: true }) })
    .click();
  await expect(preview.locator(".sf-street")).toBeVisible();
  await page
    .locator(".theme-option")
    .filter({ has: page.getByText("Boutique", { exact: true }) })
    .click();
  await expect(preview.locator(".sf-boutique")).toBeVisible();
  await page
    .locator(".theme-option")
    .filter({ has: page.getByText("Minimal", { exact: true }) })
    .click();
  await page.getByRole("tab", { name: "Бренд", exact: true }).click();
  await page.getByLabel("Назва на вітрині").fill("Тестовий бренд редактора");
  await page.getByLabel("Рядок оголошення").fill("Колекція для перевірки");
  await page.getByLabel("Акцент", { exact: true }).fill("#244aaa");
  await expect(preview.locator(".sf-brand")).toHaveText(
    "Тестовий бренд редактора",
  );
  await page.getByRole("tab", { name: "Блоки", exact: true }).click();
  await page.getByLabel("Заголовок блоку").fill("Моя перша колекція");
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "Моя перша колекція",
  );
  await page.getByLabel("Показувати блок").uncheck();
  await expect(preview.locator('[data-section="hero"]')).toHaveCount(0);
  await page.getByLabel("Показувати блок").check();
  await page
    .getByRole("button", { name: "Підняти Категорії", exact: true })
    .click();
  await expect(preview.locator("[data-section]").first()).toHaveAttribute(
    "data-section",
    "categories",
  );
  await page
    .getByRole("button", { name: "Скасувати зміну", exact: true })
    .click();
  await expect(preview.locator("[data-section]").first()).toHaveAttribute(
    "data-section",
    "hero",
  );
  await page
    .getByRole("button", { name: "Повторити зміну", exact: true })
    .click();
  await expect(preview.locator("[data-section]").first()).toHaveAttribute(
    "data-section",
    "categories",
  );
  await page
    .locator(".design-block-list li")
    .filter({
      has: page.getByRole("button", { name: "Про бренд", exact: true }),
    })
    .dragTo(page.locator(".design-block-list li").first());
  await expect(preview.locator("[data-section]").first()).toHaveAttribute(
    "data-section",
    "about",
  );
  await page.getByLabel("Фото банера · до 5 МБ").setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Формат файлу" }),
  ).toContainText("Формат файлу", {
    timeout: 120000,
  });
  await page.getByLabel("Фото банера · до 5 МБ").setInputFiles({
    name: "qa.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByText("Фото завантажено. Збережіть оформлення.", { exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await expect(preview.locator(".sf-hero-media img")).toBeVisible();
  await page
    .getByRole("button", { name: "Прибрати фото банера", exact: true })
    .click();
  await page.getByRole("button", { name: "Телефон", exact: true }).click();
  await expect(preview).toHaveClass(/preview-mobile/);
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await expect(
    page.getByText("Чернетку збережено", { exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await page.reload({ timeout: 120000 });
  await expect(preview.locator(".sf-brand")).toHaveText(
    "Тестовий бренд редактора",
  );
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "Моя перша колекція",
  );
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await expect(
    page.getByText("Магазин опубліковано", { exact: true }),
  ).toBeVisible({ timeout: 120000 });
  const anonymous = await browser.newContext();
  console.info("PASS controls, upload, persistence and first publication");
  const visitor = await anonymous.newPage();
  visitor.setDefaultTimeout(120000);
  visitor.setDefaultNavigationTimeout(120000);
  visitor.on("pageerror", (error) => browserErrors.push(error.message));
  await visitor.goto(`http://127.0.0.1:3000${publicPath}`, { timeout: 120000 });
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    "Моя перша колекція",
  );
  await expect(
    visitor.getByText("Активний тестовий товар", { exact: true }),
  ).toBeVisible();
  await expect(
    visitor.getByText("Приватний тестовий товар", { exact: true }),
  ).toHaveCount(0);
  await visitor.getByText("Активний тестовий товар", { exact: true }).click();
  console.info("PASS public catalog and product navigation");
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    "Активний тестовий товар",
  );
  await expect(visitor.getByLabel("Розмір і колір")).toBeVisible();
  await expect(
    visitor.getByText("Є в наявності", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Теми", exact: true }).click();
  console.info("PASS public variants; editing unpublished changes");
  await page
    .locator(".theme-option")
    .filter({ has: page.getByText("Boutique", { exact: true }) })
    .click();
  await page.getByRole("tab", { name: "Блоки", exact: true }).click();
  await page.getByRole("button", { name: "Банер", exact: true }).click();
  await page.getByLabel("Заголовок блоку").fill("Приватна чернетка");
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await expect(
    page.getByText("Чернетку збережено", { exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await visitor.goto(`http://127.0.0.1:3000${publicPath}`, { timeout: 120000 });
  await expect(visitor.locator(".sf-minimal")).toBeVisible();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    "Моя перша колекція",
  );
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await expect(
    page.getByText("Магазин опубліковано", { exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await visitor.reload({ timeout: 120000 });
  await expect(visitor.locator(".sf-boutique")).toBeVisible();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    "Приватна чернетка",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await visitor.setViewportSize({ width: 390, height: 844 });
  expect(
    await visitor.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("editor-phone.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("editor-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Зняти магазин з публікації", exact: true })
    .click();
  await expect(
    page.getByText("Магазин знято з публікації", { exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await visitor.goto(`http://127.0.0.1:3000${publicPath}`, {
    timeout: 120000,
  });
  await expect(visitor.locator(".storefront")).toHaveCount(0);
  await expect(
    visitor.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  await anonymous.close();
});
