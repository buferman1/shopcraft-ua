import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
const fixturePath = process.env.SHOPCRAFT_COMMERCE_FIXTURE_FILE;
test("catalog pagination and editor autosave/version restoration", async ({
  page,
}, info) => {
  test.skip(
    !fixturePath || info.project.name !== "desktop",
    "Requires isolated fixture, desktop editor",
  );
  test.setTimeout(180000);
  const f = JSON.parse(readFileSync(fixturePath!, "utf8"));
  await page.goto(`/shop/${f.slug}/catalog?q=QA+Item`);
  await expect(page.getByText("Знайдено: 25")).toBeVisible();
  await page.getByRole("link", { name: "Наступна →", exact: true }).click();
  await expect(page.getByText("Сторінка 2 з 2")).toBeVisible();
  await page.goto("/auth/login");
  await page.getByLabel("Email", { exact: true }).fill(f.email);
  await page.getByLabel("Пароль", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 90000 });
  await page.goto(`/dashboard/stores/${f.storeId}/design`);
  await page.getByLabel("Автозбереження чернетки").check();
  await page.getByRole("tab", { name: "Бренд", exact: true }).click();
  await page.getByLabel("Назва на вітрині").fill("Autosave QA");
  await expect(
    page.getByText("Чернетку збережено автоматично", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.reload();
  await expect(
    page.getByTestId("storefront-preview").locator(".sf-brand"),
  ).toHaveText("Autosave QA");
  await page.getByLabel("Історія оформлення").selectOption("1");
  await page
    .getByRole("button", { name: "Завантажити в редактор", exact: true })
    .click();
  await expect(
    page.getByTestId("storefront-preview").locator(".sf-brand"),
  ).toHaveText("Commerce QA", { timeout: 90000 });
  await page
    .getByRole("button", { name: "Зберегти чернетку", exact: true })
    .click();
  await expect(
    page.getByText("Чернетку збережено", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.goto(`/shop/${f.slug}`);
  await expect(page.locator(".sf-brand")).toHaveText("Commerce QA");
});
test("shopper cart persists and merchant confirms/cancels an order", async ({
  page,
  browser,
}, info) => {
  test.skip(!fixturePath, "Requires isolated commerce fixture");
  test.setTimeout(240000);
  const f = JSON.parse(readFileSync(fixturePath!, "utf8"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const merchant = await browser.newPage();
  await merchant.goto("/auth/login");
  await merchant.getByLabel("Email", { exact: true }).fill(f.email);
  await merchant.getByLabel("Пароль", { exact: true }).fill(f.password);
  await merchant.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(merchant).toHaveURL(/\/dashboard$/, { timeout: 90000 });
  await merchant.goto(`/dashboard/stores/${f.storeId}/settings`);
  await merchant.getByLabel("Приймати замовлення", { exact: true }).check();
  await merchant
    .getByLabel("Доставка з ручним узгодженням", { exact: true })
    .check();
  await merchant.getByLabel("Фіксована доставка (UAH)").fill("75");
  await merchant.getByRole("button", { name: "Зберегти", exact: true }).click();
  await expect(
    merchant.getByRole("status").filter({ hasText: "Налаштування збережено" }),
  ).toBeVisible({ timeout: 90000 });
  await page.goto(`/shop/${f.slug}/products/qa-shirt`);
  await page.getByRole("button", { name: "Додати до кошика" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Товар додано" }),
  ).toBeVisible();
  await page.goto(`/shop/${f.slug}/cart`);
  await page.reload();
  await expect(page.getByLabel("Кількість: QA Shirt M")).toHaveValue("1");
  await page
    .getByLabel("Ім’я", { exact: true })
    .fill(`QA ${info.project.name}`);
  await page
    .getByLabel("Телефон", { exact: true })
    .fill("380" + String(Date.now()).slice(-9));
  await page
    .getByLabel("Місто, адреса або відділення")
    .fill("QA місто, відділення 1");
  await page.getByLabel("Дозволяю передати мої контактні дані").check();
  await page.getByRole("button", { name: "Надіслати замовлення" }).click();
  await expect(page.getByRole("heading", { name: "Дякуємо!" })).toBeVisible({
    timeout: 90000,
  });
  await expect(page.getByText(/Сума: 195,00/)).toBeVisible();
  const orderId = await page.locator(".commerce-panel strong").innerText();
  expect(orderId).toMatch(/^[0-9a-f-]{36}$/);
  await merchant.goto(`/dashboard/stores/${f.storeId}/orders/${orderId}`);
  await expect(
    merchant.getByText(`QA ${info.project.name}`, { exact: true }),
  ).toBeVisible();
  await merchant.getByLabel("Наступний статус").selectOption("confirmed");
  await merchant.getByRole("button", { name: "Змінити статус" }).click();
  await expect(
    merchant
      .getByRole("status")
      .filter({ hasText: "Статус і залишки оновлено" }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    merchant.getByText("Списано під час підтвердження", { exact: true }),
  ).toBeVisible();
  await merchant.getByLabel("Наступний статус").selectOption("cancelled");
  await merchant.getByRole("button", { name: "Змінити статус" }).click();
  await expect(
    merchant.getByText("Не списані або вже повернуті", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.goto(`/shop/${f.slug}/cart`);
  await expect(page.getByText("Кошик поки порожній.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await merchant.close();
});
