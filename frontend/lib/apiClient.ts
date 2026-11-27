/**
 * The only place that calls `fetch` and reads `process.env` (guideline FE-02).
 *
 * Safe to import from both Client and Server Components: it imports nothing
 * server-only, and the caller passes the token in.
 */
import { ApiError } from "@/lib/errors";

export interface RequestOptions {
  /** JWT to send as `Authorization: Bearer <token>`. */
  token?: string | null;
  signal?: AbortSignal;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

function baseUrl(): string {
  const url =
    typeof window === "undefined"
      ? process.env.API_BASE_URL
      : process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error(
      "API base URL is not set. Define API_BASE_URL and NEXT_PUBLIC_API_BASE_URL (see .env.example).",
    );
  }
  return url.replace(/\/+$/, "");
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const { error } = body as { error: unknown };
    if (typeof error === "string" && error) return error;
  }
  return `Request failed with status ${status}`;
}

async function request<T>(
  method: Method,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "Could not reach the server");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(payload, response.status));
  }
  return (payload as { data: T }).data;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};
