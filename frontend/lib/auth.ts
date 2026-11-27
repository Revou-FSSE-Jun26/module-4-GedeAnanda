/**
 * Cookie helpers for the JWT. Client-only: this module uses `document` and
 * must never import `next/headers` (guideline FE-09). Server Components read
 * the cookie with `cookies()` and pass the token to `apiClient`.
 */

export const TOKEN_COOKIE = "revotask_token";

/** The API issues tokens that live for 24 hours. */
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** When the token stops being valid: its `exp` claim, or 24 hours from now. */
export function tokenExpiry(token: string): Date {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(payload));
    if (typeof claims === "object" && claims !== null && "exp" in claims) {
      const { exp } = claims as { exp: unknown };
      if (typeof exp === "number") return new Date(exp * 1000);
    }
  } catch {
    // Not a readable JWT: fall back to the known lifetime.
  }
  return new Date(Date.now() + TOKEN_LIFETIME_MS);
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${TOKEN_COOKIE}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

export function setToken(token: string, expires: Date = tokenExpiry(token)): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; ` +
    `Expires=${expires.toUTCString()}; SameSite=Lax${secure}`;
}

export function clearToken(): void {
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}
