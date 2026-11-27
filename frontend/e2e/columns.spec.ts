import { expect, test, type Page } from "@playwright/test";

import { api, createUser, login, unique, type TestUser } from "./helpers";

let user: TestUser;

test.beforeAll(async ({ request }) => {
  user = await createUser(request);
});

function apiCall(page: Page, method: string, pathPart: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method && response.url().includes(pathPart) && response.ok(),
  );
}

test("columns: an existing column is marked as finished, renamed and deleted from the board", async ({
  page,
  request,
}) => {
  const token = user.token;
  const title = unique("Minum");
  const me = await api<{ id: string }>(request, "get", "/api/users/me", { token });
  const board = await api<{ id: string }>(request, "post", "/api/boards", { data: { name: unique("Board") }, token });
  const column = await api<{ id: string }>(request, "post", `/api/boards/${board.id}/columns`, {
    data: { name: "Makan" },
    token,
  });
  await api(request, "post", `/api/columns/${column.id}/cards`, { data: { title, assignee_id: me.id }, token });

  await login(page, user);
  await page.goto(`/boards/${board.id}`);
  const dialog = page.getByRole("dialog", { name: "Edit column" });

  await test.step("mark the column as the place for finished cards", async () => {
    await page.getByRole("button", { name: "Edit column Makan" }).click();
    await dialog.getByRole("checkbox", { name: "Cards moved here are finished" }).check();
    await expect(dialog.getByText("Saving marks the 1 card in this column as finished.")).toBeVisible();
    const saved = apiCall(page, "PATCH", `/api/columns/${column.id}`);
    await dialog.getByRole("button", { name: "Save column" }).click();
    await saved;
    await expect(dialog).toBeHidden();
  });

  await test.step("the card in it now counts as done on My Tasks", async () => {
    await page.goto("/my-tasks");
    await expect(page.getByRole("checkbox", { name: `Mark “${title}” as done` })).toBeChecked();
    await expect(page.getByText("0 open, 1 done")).toBeVisible();
  });

  await test.step("rename the column; the new name survives a reload", async () => {
    await page.goto(`/boards/${board.id}`);
    await page.getByRole("button", { name: "Edit column Makan" }).click();
    await dialog.getByLabel("Column name").fill("Selesai");
    const saved = apiCall(page, "PATCH", `/api/columns/${column.id}`);
    await dialog.getByRole("button", { name: "Save column" }).click();
    await saved;
    await expect(page.getByTestId("column-Selesai")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("column-Selesai")).toBeVisible();
    await expect(page.getByTestId("column-Makan")).toHaveCount(0);
  });

  await test.step("delete it, only after confirming", async () => {
    await page.getByRole("button", { name: "Edit column Selesai" }).click();
    await dialog.getByRole("button", { name: "Delete column" }).click();
    await expect(dialog.getByText("Delete this column and the 1 card in it?")).toBeVisible();
    await expect(page.getByTestId("column-Selesai")).toBeVisible();
    const deleted = apiCall(page, "DELETE", `/api/columns/${column.id}`);
    await dialog.getByRole("button", { name: "Yes, delete it" }).click();
    await deleted;
    await expect(page.getByTestId("column-Selesai")).toHaveCount(0);
    await expect(page.getByText("This board has no columns yet")).toBeVisible();
  });
});
