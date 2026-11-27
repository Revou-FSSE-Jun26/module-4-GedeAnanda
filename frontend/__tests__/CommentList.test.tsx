import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CommentList } from "@/components/board/CommentList";
import { apiClient } from "@/lib/apiClient";
import type { Comment } from "@/types";

const handleError = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ token: "jwt", user: { id: "me", name: "Me", email: "me@example.com" } }),
}));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { patch: jest.fn(), delete: jest.fn() } }));

const patch = apiClient.patch as jest.Mock;
const remove = apiClient.delete as jest.Mock;

function comment(id: string, authorId: string, content: string): Comment {
  return {
    id,
    card_id: "card",
    content,
    created_at: "2026-11-27T08:00:00+00:00",
    updated_at: "2026-11-27T08:00:00+00:00",
    author: { id: authorId, name: authorId === "me" ? "Me" : "Someone Else" },
  };
}

const COMMENTS = [comment("1", "other", "First, by someone else"), comment("2", "me", "Second, by me")];

function renderList() {
  const onUpdated = jest.fn();
  const onDeleted = jest.fn();
  render(<CommentList comments={COMMENTS} onUpdated={onUpdated} onDeleted={onDeleted} />);
  const [theirs, mine] = screen.getAllByRole("listitem");
  return { onUpdated, onDeleted, theirs, mine };
}

describe("CommentList", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the comments in the order given", () => {
    const { theirs, mine } = renderList();

    expect(theirs).toHaveTextContent("First, by someone else");
    expect(mine).toHaveTextContent("Second, by me");
  });

  it("marks a comment as edited only when it really was", () => {
    const fresh = { ...comment("3", "me", "Just posted"), updated_at: "2026-11-27T08:00:00.000412+00:00" };
    const changed = { ...comment("4", "me", "Changed later"), updated_at: "2026-11-27T09:30:00+00:00" };
    render(<CommentList comments={[fresh, changed]} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const [first, second] = screen.getAllByRole("listitem");

    expect(first).not.toHaveTextContent("edited");
    expect(second).toHaveTextContent("edited");
  });

  it("offers Edit and Delete only on my own comment", () => {
    const { theirs, mine } = renderList();

    expect(within(mine).getByRole("button", { name: "Edit" })).toBeVisible();
    expect(within(mine).getByRole("button", { name: "Delete" })).toBeVisible();
    expect(within(theirs).queryByRole("button")).not.toBeInTheDocument();
  });

  it("saves an edited comment through the API", async () => {
    const updated = { ...COMMENTS[1], content: "Edited" };
    patch.mockResolvedValue(updated);
    const { onUpdated, mine } = renderList();

    await userEvent.click(within(mine).getByRole("button", { name: "Edit" }));
    const box = screen.getByLabelText("Edit your comment");
    await userEvent.clear(box);
    await userEvent.type(box, "Edited");
    await userEvent.click(screen.getByRole("button", { name: "Save comment" }));

    expect(patch).toHaveBeenCalledWith("/api/comments/2", { content: "Edited" }, { token: "jwt" });
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it("does not send an empty edit", async () => {
    const { mine } = renderList();

    await userEvent.click(within(mine).getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Edit your comment"));
    await userEvent.click(screen.getByRole("button", { name: "Save comment" }));

    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A comment cannot be empty");
  });

  it("deletes my comment through the API", async () => {
    remove.mockResolvedValue({ id: "2" });
    const { onDeleted, mine } = renderList();

    await userEvent.click(within(mine).getByRole("button", { name: "Delete" }));

    expect(remove).toHaveBeenCalledWith("/api/comments/2", { token: "jwt" });
    expect(onDeleted).toHaveBeenCalledWith("2");
  });
});
