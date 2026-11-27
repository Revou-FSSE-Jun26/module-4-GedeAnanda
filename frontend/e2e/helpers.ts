import { expect, type APIRequestContext, type Page } from "@playwright/test";

const API_URL = (process.env.E2E_API_URL ?? "http://localhost:5000").replace(/\/+$/, "");

export interface TestUser {
  name: string;
  email: string;
  password: string;
  token: string;
}

/** A value that is different on every call, so runs never collide on the live database. */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function api<T>(
  request: APIRequestContext,
  method: "get" | "post",
  path: string,
  options: { data?: unknown; token?: string } = {},
): Promise<T> {
  const response = await request[method](`${API_URL}${path}`, {
    data: options.data,
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
  });
  expect(response.ok(), `${method.toUpperCase()} ${path} answered ${response.status()}`).toBeTruthy();
  return ((await response.json()) as { data: T }).data;
}

/** Register a brand-new user through the API and return its credentials and a token. */
export async function createUser(request: APIRequestContext): Promise<TestUser> {
  const user = {
    name: "E2E Tester",
    email: `${unique("e2e")}@example.com`,
    password: unique("pw"),
  };
  await api(request, "post", "/api/auth/register", { data: user });
  const login = await api<{ access_token: string }>(request, "post", "/api/auth/login", {
    data: { email: user.email, password: user.password },
  });
  return { ...user, token: login.access_token };
}

/** Log in through the login page, as a person would. */
export async function login(page: Page, user: Pick<TestUser, "email" | "password">): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Your boards" })).toBeVisible();
}

/** Build a board with columns and cards through the API, for tests that are not about creating them. */
export async function seedBoard(
  request: APIRequestContext,
  user: TestUser,
  columns: Record<string, string[]>,
): Promise<{ id: string; name: string }> {
  const name = unique("Board");
  const board = await api<{ id: string }>(request, "post", "/api/boards", {
    data: { name },
    token: user.token,
  });
  for (const [columnName, cards] of Object.entries(columns)) {
    const column = await api<{ id: string }>(request, "post", `/api/boards/${board.id}/columns`, {
      data: { name: columnName },
      token: user.token,
    });
    for (const title of cards) {
      await api(request, "post", `/api/columns/${column.id}/cards`, {
        data: { title },
        token: user.token,
      });
    }
  }
  return { id: board.id, name };
}
