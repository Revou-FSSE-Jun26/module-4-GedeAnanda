/**
 * Server-side data loading for Server Components (guideline FE-09): the token
 * is read from the request cookie and handed to `apiClient`. Never import this
 * from a Client Component.
 */
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { apiClient } from "@/lib/apiClient";
import { TOKEN_COOKIE } from "@/lib/auth";
import { ApiError } from "@/lib/errors";

export async function getServerToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

/**
 * GET for a page. A missing or rejected session goes to /login; a 404 (unknown
 * board, or one the user is not a member of) renders the not-found page.
 */
export async function serverGet<T>(path: string): Promise<T> {
  const token = await getServerToken();
  if (!token) redirect("/login");
  try {
    return await apiClient.get<T>(path, { token });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) redirect("/login");
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }
}
