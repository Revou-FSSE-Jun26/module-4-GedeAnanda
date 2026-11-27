import { expect, test, type Page } from "@playwright/test";

import { createUser, login, seedBoard, type TestUser } from "./helpers";

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

test("labels, checklist and filters: a card is tagged, broken into steps, and found by its label", async ({
  page,
  request,
}) => {
  const board = await seedBoard(request, user, { "To Do": ["Fix login", "Write docs"] });
  const todo = page.getByTestId("column-To Do");
  const tagged = todo.getByTestId(/^card-/).filter({ hasText: "Fix login" });

  await test.step("open the card", async () => {
    await login(page, user);
    await page.goto(`/boards/${board.id}`);
    await page.getByRole("button", { name: "Fix login" }).click();
    await expect(page.getByRole("dialog", { name: "Card details" })).toBeVisible();
  });

  const dialog = page.getByRole("dialog", { name: "Card details" });

  await test.step("create a label from the card; it lands on the card", async () => {
    await dialog.getByRole("button", { name: "New label" }).click();
    await dialog.getByLabel("Label name").fill("Bug");
    await dialog.getByLabel("Colour").selectOption({ label: "Red" });
    const created = apiCall(page, "POST", "/labels");
    const attached = apiCall(page, "PATCH", "/api/cards/");
    await dialog.getByRole("button", { name: "Create label" }).click();
    await created;
    await attached;
    await expect(dialog.getByRole("button", { name: "Bug" })).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("add two steps and tick the first", async () => {
    for (const step of ["Reproduce the bug", "Ship the fix"]) {
      await dialog.getByLabel("Add a step").fill(step);
      const added = apiCall(page, "POST", "/checklist");
      await dialog.getByRole("button", { name: "Add step" }).click();
      await added;
      await expect(dialog.getByRole("checkbox", { name: step })).toBeVisible();
    }
    const ticked = apiCall(page, "PATCH", "/api/checklist-items/");
    await dialog.getByRole("checkbox", { name: "Reproduce the bug" }).check();
    await ticked;
    await expect(dialog.getByText("1 of 2 done")).toBeVisible();
  });

  await test.step("the card on the board shows the label and the progress", async () => {
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
    await expect(tagged.getByText("Bug")).toBeVisible();
    await expect(tagged.getByText("1/2")).toBeVisible();
  });

  await test.step("both are still there after a reload", async () => {
    await page.reload();
    await expect(tagged.getByText("Bug")).toBeVisible();
    await expect(tagged.getByText("1/2")).toBeVisible();
  });

  await test.step("filtering by the label hides the other card and keeps the column", async () => {
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("group", { name: "Filters" }).getByLabel("Label").selectOption({ label: "Bug" });

    await expect(page.getByText("Showing 1 matching card.")).toBeVisible();
    await expect(todo.getByRole("button", { name: "Fix login" })).toBeVisible();
    await expect(todo.getByRole("button", { name: "Write docs" })).toHaveCount(0);
    await expect(todo).toBeVisible();
  });

  await test.step("clearing the filters brings every card back", async () => {
    await page.getByRole("group", { name: "Filters" }).getByRole("button", { name: "Clear filters" }).click();

    await expect(todo.getByRole("button", { name: "Write docs" })).toBeVisible();
    await expect(page.getByText("Showing 1 matching card.")).toHaveCount(0);
  });
});
