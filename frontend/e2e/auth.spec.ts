import { expect, test } from "@playwright/test";

import { createUser, login, type TestUser } from "./helpers";

let user: TestUser;

test.beforeAll(async ({ request }) => {
  user = await createUser(request);
});

test("successful login redirects to /", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Your boards" })).toBeVisible();
});

test("invalid credentials show an error and stay on /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();

  // Next.js adds its own empty role="alert" route announcer, so the form's alert is picked by its text.
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/login");
});

test("unauthenticated visit to / redirects to /login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("after logout, visiting / redirects to /login", async ({ page }) => {
  await login(page, user);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/");
  await expect(page).toHaveURL("/login");
});
