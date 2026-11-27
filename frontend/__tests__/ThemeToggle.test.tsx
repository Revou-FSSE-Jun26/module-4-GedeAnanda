import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_COOKIE } from "@/lib/theme";

/** jsdom has no matchMedia; this stands in for an operating system set to light or dark. */
function setSystemTheme(dark: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: dark,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
}

function clearChoice() {
  delete document.documentElement.dataset.theme;
  document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
}

// REQ-33.1 to REQ-33.3
describe("ThemeToggle", () => {
  beforeEach(() => {
    clearChoice();
    setSystemTheme(false);
  });

  it("offers the dark theme when the page is light", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });

  it("follows the operating system when no theme was chosen", () => {
    setSystemTheme(true);

    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  });

  it("switches the page, remembers the choice in a cookie, and then offers the way back", async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  });

  it("lets a chosen theme win over the operating system", () => {
    setSystemTheme(true);
    document.documentElement.dataset.theme = "light";

    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });
});
