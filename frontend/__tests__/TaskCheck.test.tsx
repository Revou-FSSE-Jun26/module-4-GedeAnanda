import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TaskCheck } from "@/components/tasks/TaskCheck";
import { apiClient } from "@/lib/apiClient";
import { toast } from "@/lib/toast";

const handleError = jest.fn();
const refresh = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "jwt" }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { get: jest.fn(), patch: jest.fn() } }));
jest.mock("@/lib/toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const api = apiClient as jest.Mocked<typeof apiClient>;

const open = { id: "card-1", board_id: "board-1", title: "Minum", completed_at: null };
const finished = { ...open, completed_at: "2026-11-27T10:00:00Z" };

const board = {
  columns: [
    { id: "todo", order: 1024, is_done: false, cards: [{ id: "card-1", order: 1024 }] },
    { id: "done", order: 2048, is_done: true, cards: [{ id: "x", order: 1024 }] },
  ],
};

const box = () => screen.getByRole("checkbox", { name: "Mark “Minum” as done" });

// REQ-38
describe("TaskCheck", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is unchecked for an open card and checked for a finished one", () => {
    const { unmount } = render(<TaskCheck card={open} />);
    expect(box()).not.toBeChecked();
    unmount();

    render(<TaskCheck card={finished} />);
    expect(box()).toBeChecked();
  });

  it("moves a ticked card to the end of the done column and reloads the page data", async () => {
    api.get.mockResolvedValue(board);
    api.patch.mockResolvedValue({});
    render(<TaskCheck card={open} />);

    await userEvent.click(box());

    expect(api.get).toHaveBeenCalledWith("/api/boards/board-1", { token: "jwt" });
    expect(api.patch).toHaveBeenCalledWith(
      "/api/cards/card-1/position",
      { column_id: "done", order: 2048 },
      { token: "jwt" },
    );
    expect(box()).toBeChecked();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("moves an unticked card back to the first column that is not done", async () => {
    api.get.mockResolvedValue(board);
    api.patch.mockResolvedValue({});
    render(<TaskCheck card={finished} />);

    await userEvent.click(box());

    expect(api.patch).toHaveBeenCalledWith(
      "/api/cards/card-1/position",
      { column_id: "todo", order: 2048 },
      { token: "jwt" },
    );
    expect(box()).not.toBeChecked();
  });

  it("shows the tick before the API has answered", async () => {
    api.get.mockReturnValue(new Promise(() => {})); // never answers
    render(<TaskCheck card={open} />);

    await userEvent.click(box());

    expect(box()).toBeChecked();
  });

  it("unticks again, sends no move and says why when the board has no done column", async () => {
    api.get.mockResolvedValue({ columns: [board.columns[0]] });
    render(<TaskCheck card={open} />);

    await userEvent.click(box());

    await waitFor(() => expect(box()).not.toBeChecked());
    expect(api.patch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("no column for finished cards"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("unticks again and reports the error when the move is refused", async () => {
    const failure = new Error("offline");
    api.get.mockResolvedValue(board);
    api.patch.mockRejectedValue(failure);
    render(<TaskCheck card={open} />);

    await userEvent.click(box());

    await waitFor(() => expect(box()).not.toBeChecked());
    expect(handleError).toHaveBeenCalledWith(failure);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("can be used again after a failed attempt", async () => {
    api.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(board);
    api.patch.mockResolvedValue({});
    render(<TaskCheck card={open} />);

    await userEvent.click(box());
    await waitFor(() => expect(box()).toBeEnabled());
    await userEvent.click(box());

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(box()).toBeChecked();
  });
});
