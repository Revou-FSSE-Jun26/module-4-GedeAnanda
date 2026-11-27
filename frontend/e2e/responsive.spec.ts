import { expect, test, type Page } from "@playwright/test";

import { createUser, login, seedBoard, type TestUser } from "./helpers";

/** REQ-20: every page works at 375 px, and only the board scrolls sideways. */
test.use({ viewport: { width: 375, height: 812 } });

let user: TestUser;
let boardId: string;

test.beforeAll(async ({ request }) => {
  user = await createUser(request);
  const board = await seedBoard(request, user, {
    "To Do": ["A card with a rather long title that has to wrap onto several lines", "Second"],
    Doing: ["Third"],
    Done: [],
  });
  boardId = board.id;
});

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "the page itself must not scroll sideways").toBeLessThanOrEqual(0);
}

/** Every button and field is at least 44 px tall (REQ-20.3). */
async function expectTapTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, input:not([type=checkbox]), select, nav a")]
      .filter((element) => element.offsetParent !== null)
      .map((element) => ({ text: element.innerText || element.id, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.height < 44 || box.width < 44)
      .map(({ text, box }) => `${text} (${Math.round(box.width)}x${Math.round(box.height)})`),
  );
  expect(small, "controls smaller than 44 x 44 px").toEqual([]);
}

for (const path of ["/login", "/register"]) {
  test(`${path} fits a 375 px screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByLabel("Email")).toBeVisible();

    await expectNoSidewaysScroll(page);
    await expectTapTargets(page);
  });
}

test("signed-in pages fit a 375 px screen", async ({ page }) => {
  await login(page, user);
  await expectNoSidewaysScroll(page);
  await expectTapTargets(page);

  await page.getByRole("button", { name: /^Notifications/ }).click();
  const panel = page.getByRole("region", { name: "Notifications" });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await page.keyboard.press("Escape");

  for (const [path, heading] of [
    ["/my-tasks", "My tasks"],
    ["/profile", "Profile"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await expectTapTargets(page);
  }
});

test("the board scrolls sideways inside its own strip, not the page", async ({ page }) => {
  await login(page, user);
  await page.goto(`/boards/${boardId}`);
  const done = page.getByTestId("column-Done");
  await expect(page.getByTestId("column-To Do")).toBeVisible();

  await expectNoSidewaysScroll(page);
  await expectTapTargets(page);
  await expect(done).not.toBeInViewport();

  await done.scrollIntoViewIfNeeded();
  await expect(done).toBeInViewport();
  await expectNoSidewaysScroll(page);
});

test("a card can be opened and moved without dragging", async ({ page }) => {
  await login(page, user);
  await page.goto(`/boards/${boardId}`);

  await page.getByRole("button", { name: "Second" }).click();
  const dialog = page.getByRole("dialog", { name: "Card details" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);

  const moved = page.waitForResponse(
    (response) => response.url().includes("/position") && response.ok(),
  );
  await dialog.getByLabel("Move to column").selectOption({ label: "Done" });
  await moved;
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("column-Done").getByText("Second")).toBeAttached();
  await expect(page.getByTestId("column-To Do").getByText("Second")).toHaveCount(0);
});
