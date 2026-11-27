import { render, screen } from "@testing-library/react";

import { Avatar } from "@/components/shared/Avatar";

// REQ-33.4
describe("Avatar", () => {
  it("shows the initials and keeps the full name as its accessible name", () => {
    render(<Avatar id="user-1" name="Maya Pratama" />);

    const avatar = screen.getByRole("img", { name: "Maya Pratama" });
    expect(avatar).toHaveTextContent("MP");
  });

  it("gives one person the same colour everywhere, whatever their name is", () => {
    render(
      <>
        <Avatar id="user-1" name="Maya Pratama" />
        <Avatar id="user-1" name="Maya P." />
      </>,
    );

    const [first, second] = screen.getAllByRole("img");
    expect(first.dataset.marker).toBeTruthy();
    expect(first.dataset.marker).toBe(second.dataset.marker);
  });

  it("is hidden from screen readers when the name is written beside it", () => {
    const { container } = render(<Avatar id="user-1" name="Maya Pratama" decorative />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
