import { test, expect } from "@playwright/test";
test("landing navigation and mobile layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Ідея ваша/ })).toBeVisible();
  await page.getByRole("link", { name: "Створити профіль →" }).click();
  await expect(
    page.getByRole("heading", { name: "Ваш магазин починається тут" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("unauthenticated user cannot open store administration", async ({
  page,
}) => {
  await page.goto("/dashboard/stores/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByLabel("Пароль", { exact: true })).toBeVisible();
});
test("registration rejects short passwords without contacting email service", async ({
  page,
}) => {
  await page.goto("/auth/signup");
  await page
    .getByLabel("Email", { exact: true })
    .fill("validation@example.invalid");
  await page.getByLabel("Пароль", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Створити профіль" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Мінімум 12 символів" })).toHaveText("Мінімум 12 символів");
});
test("callback without code redirects to controlled error page", async ({
  page,
}) => {
  await page.goto("/auth/callback?next=https://evil.example");
  await expect(page).toHaveURL(/\/auth\/login\?error=callback/);
  await expect(page.getByRole("alert").filter({ hasText: "Посилання недійсне або застаріле. Спробуйте ще раз" })).toBeVisible();
});
