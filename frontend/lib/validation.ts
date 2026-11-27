/** Client-side checks that mirror the API's rules, so obvious mistakes never leave the browser. */

export const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
