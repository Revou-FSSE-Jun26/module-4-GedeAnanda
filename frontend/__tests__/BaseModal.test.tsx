import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <BaseButton onClick={() => setOpen(true)}>New board</BaseButton>
      <BaseModal open={open} title="Create a board" onClose={() => setOpen(false)}>
        <label htmlFor="board-name">Board name</label>
        <input id="board-name" />
        <BaseButton>Create board</BaseButton>
      </BaseModal>
    </>
  );
}

describe("BaseModal", () => {
  it("renders nothing while closed", () => {
    render(<Harness />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as a labelled dialog and takes focus", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "New board" }));

    const dialog = screen.getByRole("dialog", { name: "Create a board" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "New board" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByLabelText("Board name"));

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes with the Close button and returns focus to the trigger", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "New board" });
    await userEvent.click(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps Tab inside the dialog", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "New board" }));
    const last = screen.getByRole("button", { name: "Create board" });
    const first = screen.getByRole("button", { name: "Close" });

    last.focus();
    await userEvent.tab();
    expect(first).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
  });
});
