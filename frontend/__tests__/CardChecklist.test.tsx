import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CardChecklist } from "@/components/board/CardChecklist";
import { apiClient } from "@/lib/apiClient";
import type { Card } from "@/types";

const handleError = jest.fn();

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "jwt" }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({
  apiClient: { post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const api = apiClient as jest.Mocked<typeof apiClient>;

const card: Card = {
  id: "card-1",
  column_id: "todo",
  board_id: "board",
  board_name: "Sprint",
  title: "Write docs",
  description: null,
  priority: "medium",
  due_date: null,
  order: 1024,
  completed_at: null,
  created_by: "user",
  assignee: null,
  labels: [],
  checklist: [
    { id: "i1", text: "Outline", is_done: true },
    { id: "i2", text: "Draft", is_done: false },
  ],
};

// REQ-35.8
describe("CardChecklist", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows each step with its state and the progress", () => {
    render(<CardChecklist card={card} onSaved={jest.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Outline" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Draft" })).not.toBeChecked();
    expect(screen.getByText("1 of 2 done")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Checklist: 1 of 2 done" })).toHaveValue(1);
  });

  it("shows no progress for a card without steps", () => {
    render(<CardChecklist card={{ ...card, checklist: [] }} onSaved={jest.fn()} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/done$/)).not.toBeInTheDocument();
  });

  it("ticks a step through the API and hands back the card with the new state", async () => {
    api.patch.mockResolvedValue({ id: "i2", card_id: "card-1", text: "Draft", is_done: true });
    const onSaved = jest.fn();
    render(<CardChecklist card={card} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Draft" }));

    expect(api.patch).toHaveBeenCalledWith("/api/checklist-items/i2", { is_done: true }, { token: "jwt" });
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "card-1",
        checklist: [
          { id: "i1", text: "Outline", is_done: true },
          { id: "i2", text: "Draft", is_done: true },
        ],
      }),
    );
  });

  it("adds a trimmed step at the end and clears the field", async () => {
    api.post.mockResolvedValue({ id: "i3", card_id: "card-1", text: "Review", is_done: false });
    const onSaved = jest.fn();
    render(<CardChecklist card={card} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Add a step"), "  Review  ");
    await userEvent.click(screen.getByRole("button", { name: "Add step" }));

    expect(api.post).toHaveBeenCalledWith("/api/cards/card-1/checklist", { text: "Review" }, { token: "jwt" });
    expect(onSaved.mock.calls[0][0].checklist.map((item: { text: string }) => item.text)).toEqual([
      "Outline",
      "Draft",
      "Review",
    ]);
    expect(screen.getByLabelText("Add a step")).toHaveValue("");
  });

  it("does not send an empty step", async () => {
    render(<CardChecklist card={card} onSaved={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Add step" }));

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Write the step first");
  });

  it("deletes a step and keeps the others", async () => {
    api.delete.mockResolvedValue({ id: "i1" });
    const onSaved = jest.fn();
    render(<CardChecklist card={card} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete step: Outline" }));

    expect(api.delete).toHaveBeenCalledWith("/api/checklist-items/i1", { token: "jwt" });
    expect(onSaved.mock.calls[0][0].checklist).toEqual([{ id: "i2", text: "Draft", is_done: false }]);
  });

  it("ticks the box before the API answers", async () => {
    api.patch.mockReturnValue(new Promise(() => {})); // never answers
    const onSaved = jest.fn();
    render(<CardChecklist card={card} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Draft" }));

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0].checklist[1]).toEqual({ id: "i2", text: "Draft", is_done: true });
  });

  it("puts the checklist back and reports the error when the API refuses a tick", async () => {
    const failure = new Error("offline");
    api.patch.mockRejectedValue(failure);
    const onSaved = jest.fn();
    render(<CardChecklist card={card} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Draft" }));

    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenLastCalledWith(card);
    expect(handleError).toHaveBeenCalledWith(failure);
  });

  it("leaves the card alone and reports the error when adding a step fails", async () => {
    const failure = new Error("offline");
    api.post.mockRejectedValue(failure);
    const onSaved = jest.fn();
    render(<CardChecklist card={card} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Add a step"), "Review");
    await userEvent.click(screen.getByRole("button", { name: "Add step" }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(failure);
  });
});
