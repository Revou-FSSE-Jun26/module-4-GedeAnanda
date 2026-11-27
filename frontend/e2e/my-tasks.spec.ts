import { expect, test, type Page } from "@playwright/test";

import { api, createUser, login, unique, type TestUser } from "./helpers";

let user: TestUser;

test.beforeAll(async ({ request }) => {
  user = await createUser(request);
});

function moved(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().includes("/position") && response.ok(),
  );
}

test("My Tasks: ticking a task finishes it, and unticking reopens it", async ({ page, request }) => {
  const token = user.token;
  const title = unique("Call the supplier");
  const me = await api<{ id: string }>(request, "get", "/api/users/me", { token });
  const board = await api<{ id: string }>(request, "post", "/api/boards", { data: { name: unique("Board") }, token });
  const todo = await api<{ id: string }>(request, "post", `/api/boards/${board.id}/columns`, {
    data: { name: "To Do" },
    token,
  });
  await api(request, "post", `/api/boards/${board.id}/columns`, { data: { name: "Done", is_done: true }, token });
  await api(request, "post", `/api/columns/${todo.id}/cards`, { data: { title, assignee_id: me.id }, token });

  await login(page, user);
  await page.goto("/my-tasks");
  const box = page.getByRole("checkbox", { name: `Mark “${title}” as done` });
  const row = page.getByRole("listitem").filter({ hasText: title });

  await test.step("the task starts open", async () => {
    await expect(box).not.toBeChecked();
    await expect(page.getByText("1 open, 0 done")).toBeVisible();
  });

  await test.step("ticking it moves the card to Done", async () => {
    const done = moved(page);
    await box.check();
    await done;
    await expect(page.getByText("0 open, 1 done")).toBeVisible();
    await expect(row.getByText("Done", { exact: true })).toBeVisible();
  });

  await test.step("it is in the Done column on the board, and still ticked after a reload", async () => {
    await page.goto(`/boards/${board.id}`);
    await expect(page.getByTestId("column-Done").getByRole("button", { name: title })).toBeVisible();
    await page.goto("/my-tasks");
    await expect(box).toBeChecked();
  });

  await test.step("unticking it moves the card back to To Do", async () => {
    const reopened = moved(page);
    await box.uncheck();
    await reopened;
    await expect(page.getByText("1 open, 0 done")).toBeVisible();
    await page.goto(`/boards/${board.id}`);
    await expect(page.getByTestId("column-To Do").getByRole("button", { name: title })).toBeVisible();
  });
});

test("My Tasks: a board without a done column explains why the task cannot be ticked", async ({
  page,
  request,
}) => {
  const token = user.token;
  const title = unique("Water the plants");
  const me = await api<{ id: string }>(request, "get", "/api/users/me", { token });
  const board = await api<{ id: string }>(request, "post", "/api/boards", { data: { name: unique("Board") }, token });
  const only = await api<{ id: string }>(request, "post", `/api/boards/${board.id}/columns`, {
    data: { name: "Everything" },
    token,
  });
  await api(request, "post", `/api/columns/${only.id}/cards`, { data: { title, assignee_id: me.id }, token });

  await login(page, user);
  await page.goto("/my-tasks");
  const box = page.getByRole("checkbox", { name: `Mark “${title}” as done` });

  await box.click();

  await expect(page.getByText(/no column for finished cards/)).toBeVisible();
  await expect(box).not.toBeChecked();
});
