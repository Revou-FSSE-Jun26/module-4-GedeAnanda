import { render, screen } from "@testing-library/react";

import { BaseBadge } from "@/components/shared/BaseBadge";
import type { Priority } from "@/types";

const CASES: [Priority, string][] = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
];

describe("BaseBadge", () => {
  it.each(CASES)("always shows the priority text for %s", (priority, label) => {
    render(<BaseBadge priority={priority} />);

    expect(screen.getByText(label)).toBeVisible();
  });

  it("gives each priority its own colour", () => {
    render(
      <>
        {CASES.map(([priority]) => (
          <BaseBadge key={priority} priority={priority} />
        ))}
      </>,
    );

    const styles = CASES.map(([, label]) => screen.getByText(label).className);

    expect(new Set(styles).size).toBe(3);
  });
});
