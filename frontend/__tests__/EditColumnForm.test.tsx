import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EditColumnForm } from "@/components/board/EditColumnForm";
import { apiClient } from "@/lib/apiClient";
import type { Column, Role } from "@/types";

const handleError = jest.fn();

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "jwt" }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { patch: jest.fn(), delete: jest.fn() } }));
jest.mock("@/lib/toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const api = apiClient as jest.Mocked<typeof apiClient>;

const column: Column = { id: "col-1", board_id: "board", name: "Makan", order: 1024, is_done: false };

function setup(role: Role = "admin", cardCount = 2) {
  const onUpdated = jest.fn();
  const onDeleted = jest.fn();
  render(
    <EditColumnForm column={column} cardCount={cardCount} role={role} onUpdated={onUpdated} onDeleted={onDeleted} />,
  );
  return { onUpdated, onDeleted };
}

async function openForm() {
  await userEvent.click(screen.getByRole("button", { name: "Edit column Makan" }));
  return screen.getByRole("dialog", { name: "Edit column" });
}

// REQ-39.1 to REQ-39.5
describe("EditColumnForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens with the column's current name and setting", async () => {
    setup();

    await openForm();

    expect(screen.getByLabelText("Column name")).toHaveValue("Makan");
    expect(screen.getByRole("checkbox", { name: "Cards moved here are finished" })).not.toBeChecked();
  });

  it("sends only the name when only the name changed", async () => {
    const saved = { ...column, name: "Dapur" };
    api.patch.mockResolvedValue(saved);
    const { onUpdated } = setup();
    await openForm();

    await userEvent.clear(screen.getByLabelText("Column name"));
    await userEvent.type(screen.getByLabelText("Column name"), "  Dapur ");
    await userEvent.click(screen.getByRole("button", { name: "Save column" }));

    expect(api.patch).toHaveBeenCalledWith("/api/columns/col-1", { name: "Dapur" }, { token: "jwt" });
    expect(onUpdated).toHaveBeenCalledWith(saved);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends only is_done when only the finished setting changed, and warns what happens to the cards", async () => {
    api.patch.mockResolvedValue({ ...column, is_done: true });
    setup("member", 2);
    await openForm();

    await userEvent.click(screen.getByRole("checkbox", { name: "Cards moved here are finished" }));

    expect(screen.getByText("Saving marks the 2 cards in this column as finished.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save column" }));
    expect(api.patch).toHaveBeenCalledWith("/api/columns/col-1", { is_done: true }, { token: "jwt" });
  });

  it("closes without a request when nothing changed", async () => {
    const { onUpdated } = setup();
    await openForm();

    await userEvent.click(screen.getByRole("button", { name: "Save column" }));

    expect(api.patch).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refuses an empty name without sending a request", async () => {
    setup();
    await openForm();

    await userEvent.clear(screen.getByLabelText("Column name"));
    await userEvent.click(screen.getByRole("button", { name: "Save column" }));

    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Column name")).toHaveAccessibleDescription("Give the column a name");
  });

  it("stays open and reports the error when saving fails", async () => {
    const failure = new Error("offline");
    api.patch.mockRejectedValue(failure);
    const { onUpdated } = setup();
    await openForm();

    await userEvent.type(screen.getByLabelText("Column name"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save column" }));

    expect(handleError).toHaveBeenCalledWith(failure);
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit column" })).toBeVisible();
  });

  it("does not delete on the first click; it asks, naming the number of cards", async () => {
    setup("admin", 2);
    await openForm();

    await userEvent.click(screen.getByRole("button", { name: "Delete column" }));

    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Delete this column and the 2 cards in it?");
  });

  it("deletes after the confirmation", async () => {
    api.delete.mockResolvedValue({ id: "col-1" });
    const { onDeleted } = setup("admin", 1);
    await openForm();

    await userEvent.click(screen.getByRole("button", { name: "Delete column" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));

    expect(api.delete).toHaveBeenCalledWith("/api/columns/col-1", { token: "jwt" });
    expect(onDeleted).toHaveBeenCalledWith("col-1");
  });

  it("keeps the column when the user backs out of deleting", async () => {
    const { onDeleted } = setup();
    await openForm();

    await userEvent.click(screen.getByRole("button", { name: "Delete column" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep the column" }));

    expect(api.delete).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete column" })).toBeVisible();
  });

  it("offers no delete to a member who is not an admin", async () => {
    setup("member");
    await openForm();

    expect(screen.queryByRole("button", { name: "Delete column" })).not.toBeInTheDocument();
  });
});
