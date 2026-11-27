import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CardLabels } from "@/components/board/CardLabels";
import { apiClient } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import type { Card, Label } from "@/types";

const handleError = jest.fn();

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "jwt" }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { post: jest.fn(), patch: jest.fn() } }));

const api = apiClient as jest.Mocked<typeof apiClient>;

const BUG: Label = { id: "bug", name: "Bug", color: "poppy" };
const DESIGN: Label = { id: "design", name: "Design", color: "plum" };

const card: Card = {
  id: "card-1",
  column_id: "todo",
  board_id: "board-1",
  board_name: "Sprint",
  title: "Write docs",
  description: null,
  priority: "medium",
  due_date: null,
  order: 1024,
  completed_at: null,
  created_by: "user",
  assignee: null,
  labels: [BUG],
  checklist: [],
};

function setup(labels: Label[] = [BUG, DESIGN]) {
  const onSaved = jest.fn();
  const onLabelCreated = jest.fn();
  render(<CardLabels card={card} labels={labels} onSaved={onSaved} onLabelCreated={onLabelCreated} />);
  return { onSaved, onLabelCreated };
}

// REQ-34.14
describe("CardLabels", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows every board label and marks the ones on the card as pressed", () => {
    setup();

    expect(screen.getByRole("button", { name: "Bug" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute("aria-pressed", "false");
  });

  it("adds a label by sending the full new list", async () => {
    const saved = { ...card, labels: [BUG, DESIGN] };
    api.patch.mockResolvedValue(saved);
    const { onSaved } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Design" }));

    expect(api.patch).toHaveBeenCalledWith("/api/cards/card-1", { label_ids: ["bug", "design"] }, { token: "jwt" });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("removes a label that is on the card", async () => {
    api.patch.mockResolvedValue({ ...card, labels: [] });
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Bug" }));

    expect(api.patch).toHaveBeenCalledWith("/api/cards/card-1", { label_ids: [] }, { token: "jwt" });
  });

  it("creates a label on the board and puts it on this card", async () => {
    const created: Label = { id: "chore", name: "Chore", color: "teal" };
    api.post.mockResolvedValue(created);
    api.patch.mockResolvedValue({ ...card, labels: [BUG, created] });
    const { onLabelCreated, onSaved } = setup();

    await userEvent.click(screen.getByRole("button", { name: "New label" }));
    await userEvent.type(screen.getByLabelText("Label name"), " Chore ");
    await userEvent.selectOptions(screen.getByLabelText("Colour"), "Teal");
    await userEvent.click(screen.getByRole("button", { name: "Create label" }));

    expect(api.post).toHaveBeenCalledWith("/api/boards/board-1/labels", { name: "Chore", color: "teal" }, { token: "jwt" });
    expect(onLabelCreated).toHaveBeenCalledWith(created);
    expect(api.patch).toHaveBeenCalledWith("/api/cards/card-1", { label_ids: ["bug", "chore"] }, { token: "jwt" });
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows a duplicate name under the field instead of a toast", async () => {
    api.post.mockRejectedValue(new ApiError(409, "This board already has a label with that name"));
    const { onLabelCreated } = setup();

    await userEvent.click(screen.getByRole("button", { name: "New label" }));
    await userEvent.type(screen.getByLabelText("Label name"), "bug");
    await userEvent.click(screen.getByRole("button", { name: "Create label" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already has a label with that name");
    expect(handleError).not.toHaveBeenCalled();
    expect(onLabelCreated).not.toHaveBeenCalled();
  });

  it("does not send a label without a name", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "New label" }));
    await userEvent.click(screen.getByRole("button", { name: "Create label" }));

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Give the label a name");
  });

  it("explains what labels are when the board has none", () => {
    setup([]);

    expect(screen.getByText(/This board has no labels yet/)).toBeVisible();
  });
});
