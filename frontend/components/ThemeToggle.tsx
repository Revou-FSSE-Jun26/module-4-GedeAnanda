"use client";

import { useSyncExternalStore } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";
import { chooseTheme, currentTheme, watchTheme, type Theme } from "@/lib/theme";

/** The server cannot know the operating system's setting, so it assumes light until the browser says. */
function serverTheme(): Theme {
  return "light";
}

/** Switches between the light and the dark theme (REQ-33.1). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(watchTheme, currentTheme, serverTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <BaseButton
      variant="secondary"
      onClick={() => chooseTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className="px-0"
    >
      <Icon name={next === "dark" ? "moon" : "sun"} />
    </BaseButton>
  );
}
