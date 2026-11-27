import { expect, test, type Page } from "@playwright/test";

import { createUser, login, unique, type TestUser } from "./helpers";

let user: TestUser;

test.beforeAll(async ({ request }) => {
  user = await createUser(request);
});

/** Start waiting for a successful API call before the action that causes it. */
function apiCall(page: Page, method: string, pathPart: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method && response.url().includes(pathPart) && response.ok(),
  );
}

async function addColumn(page: Page, name: string) {
  await page.getByRole("button", { name: "Add column" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a column" });
  await dialog.getByLabel("Column name").fill(name);
  const created = apiCall(page, "POST", "/columns");
  await dialog.getByRole("button", { name: "Add column" }).click();
  await created;
  await expect(page.getByTestId(`column-${name}`)).toBeVisible();
}

test("Kanban journey: a card dragged to Done is still there after a reload", async ({ page }) => {
  const boardName = unique("Launch");
  const cardTitle = unique("Write the announcement");

  await test.step("1. log in", async () => {
    await login(page, user);
  });

  await test.step("2. create a board", async () => {
    await page.getByRole("button", { name: "New board" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a board" });
    await dialog.getByLabel("Board name").fill(boardName);
    const created = apiCall(page, "POST", "/api/boards");
    await dialog.getByRole("button", { name: "Create board" }).click();
    await created;

    const boardLink = page.getByRole("link", { name: boardName });
    await expect(boardLink).toBeVisible();
    await boardLink.click();
    await expect(page.getByRole("heading", { name: boardName })).toBeVisible();
  });

  await test.step('3. add a "To Do" column', async () => {
    await addColumn(page, "To Do");
  });

  await test.step('4. add a "Done" column', async () => {
    await addColumn(page, "Done");
  });

  const todo = page.getByTestId("column-To Do");
  const done = page.getByTestId("column-Done");

  await test.step('5. create a card in "To Do"', async () => {
    await page.getByRole("button", { name: "Add card to To Do" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a card to To Do" });
    await dialog.getByLabel("Card title").fill(cardTitle);
    const created = apiCall(page, "POST", "/cards");
    await dialog.getByRole("button", { name: "Add card" }).click();
    await created;
    await expect(todo.getByText(cardTitle)).toBeVisible();
  });

  await test.step('6. drag the card to "Done"', async () => {
    const moved = apiCall(page, "PATCH", "/position");
    await todo.getByText(cardTitle).dragTo(done);
    await moved;
    await expect(done.getByText(cardTitle)).toBeVisible();
    await expect(todo.getByText(cardTitle)).toHaveCount(0);
  });

  await test.step("7. reload the page", async () => {
    await page.reload();
  });

  await test.step('8. the card is still in "Done"', async () => {
    await expect(done.getByText(cardTitle)).toBeVisible();
    await expect(todo.getByText(cardTitle)).toHaveCount(0);
  });
});
