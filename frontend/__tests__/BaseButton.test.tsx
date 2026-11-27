import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BaseButton, type ButtonVariant } from "@/components/shared/BaseButton";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "destructive"];

describe("BaseButton", () => {
  it.each(VARIANTS)("renders the %s variant and fires onClick", async (variant) => {
    const onClick = jest.fn();
    render(
      <BaseButton variant={variant} onClick={onClick}>
        Save changes
      </BaseButton>,
    );

    const button = screen.getByRole("button", { name: "Save changes" });
    await userEvent.click(button);

    expect(button).toHaveAttribute("data-variant", variant);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("gives each variant its own style", () => {
    render(
      <>
        {VARIANTS.map((variant) => (
          <BaseButton key={variant} variant={variant}>
            {variant}
          </BaseButton>
        ))}
      </>,
    );

    const styles = VARIANTS.map((variant) => screen.getByRole("button", { name: variant }).className);

    expect(new Set(styles).size).toBe(3);
  });

  it("defaults to the primary variant and to type=button", () => {
    render(<BaseButton>Add card</BaseButton>);

    const button = screen.getByRole("button", { name: "Add card" });

    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("type", "button");
  });

  it("does not fire onClick while disabled", async () => {
    const onClick = jest.fn();
    render(
      <BaseButton onClick={onClick} disabled>
        Saving
      </BaseButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Saving" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("is at least 44 by 44 pixels", () => {
    render(<BaseButton>Tap</BaseButton>);

    const button = screen.getByRole("button", { name: "Tap" });

    expect(button).toHaveClass("min-h-[44px]", "min-w-[44px]");
  });
});
