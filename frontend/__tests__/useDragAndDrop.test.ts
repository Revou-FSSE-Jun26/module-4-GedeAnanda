import { act, renderHook } from "@testing-library/react";
import { useState } from "react";

import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { apiClient } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import type { Card, CardMoveResult, ColumnWithCards } from "@/types";

const handleError = jest.fn();

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "jwt" }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { patch: jest.fn() } }));

const patch = apiClient.patch as jest.Mock;

function card(id: string, column_id: string, order: number): Card {
  return {
    id,
    column_id,
    board_id: "board",
    board_name: "Sprint",
    title: `Card ${id}`,
    description: null,
    priority: "medium",
    due_date: null,
    order,
    completed_at: null,
    created_by: "user",
    assignee: null,
    labels: [],
    checklist: [],
  };
}

const initial = (): ColumnWithCards[] => [
  {
    id: "todo",
    board_id: "board",
    name: "To Do",
    order: 1024,
    is_done: false,
    cards: [card("a", "todo", 1024), card("b", "todo", 2048)],
  },
  { id: "done", board_id: "board", name: "Done", order: 2048, is_done: true, cards: [card("x", "done", 1024)] },
];

function layout(columns: ColumnWithCards[]) {
  return Object.fromEntries(columns.map((column) => [column.id, column.cards.map((item) => item.id)]));
}

function setup() {
  return renderHook(() => {
    const [columns, setColumns] = useState(initial);
    return { columns, dnd: useDragAndDrop(columns, setColumns) };
  });
}

/** A promise the test settles by hand, to look at the board while the request is in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useDragAndDrop", () => {
  beforeEach(() => jest.clearAllMocks());

  it("moves the card on screen before the API answers, and sends the computed order", async () => {
    const pending = deferred<CardMoveResult>();
    patch.mockReturnValue(pending.promise);
    const { result } = setup();

    act(() => void result.current.dnd.moveCard("a", "done"));

    expect(layout(result.current.columns)).toEqual({ todo: ["b"], done: ["x", "a"] });
    expect(patch).toHaveBeenCalledWith(
      "/api/cards/a/position",
      { column_id: "done", order: 2048 },
      { token: "jwt" },
    );

    await act(async () => {
      pending.resolve({
        card: { ...card("a", "done", 2048), completed_at: "2026-11-27T08:00:00+00:00" },
        rebalanced: false,
        column_orders: [],
      });
    });

    expect(layout(result.current.columns)).toEqual({ todo: ["b"], done: ["x", "a"] });
    expect(result.current.columns[1].cards[1].completed_at).not.toBeNull();
    expect(handleError).not.toHaveBeenCalled();
  });

  it("puts the card back where it was and reports the error when the API fails", async () => {
    const error = new ApiError(500, "Internal server error");
    const pending = deferred<CardMoveResult>();
    patch.mockReturnValue(pending.promise);
    const { result } = setup();
    const before = result.current.columns;

    act(() => void result.current.dnd.moveCard("a", "done"));
    expect(layout(result.current.columns)).toEqual({ todo: ["b"], done: ["x", "a"] });

    await act(async () => {
      pending.reject(error);
    });

    expect(result.current.columns).toBe(before);
    expect(layout(result.current.columns)).toEqual({ todo: ["a", "b"], done: ["x"] });
    expect(result.current.columns[0].cards[0]).toMatchObject({ column_id: "todo", order: 1024 });
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(error);
  });

  it("drops before the card it was released on", async () => {
    patch.mockResolvedValue({ card: card("a", "done", 512), rebalanced: false, column_orders: [] });
    const { result } = setup();

    await act(() => result.current.dnd.moveCard("a", "done", "x"));

    expect(patch).toHaveBeenCalledWith(
      "/api/cards/a/position",
      { column_id: "done", order: 512 },
      { token: "jwt" },
    );
    expect(layout(result.current.columns)).toEqual({ todo: ["b"], done: ["a", "x"] });
  });

  it("applies the server's new orders after a rebalance", async () => {
    patch.mockResolvedValue({
      card: card("a", "done", 1024),
      rebalanced: true,
      column_orders: [
        { id: "a", order: 1024 },
        { id: "x", order: 2048 },
      ],
    });
    const { result } = setup();

    await act(() => result.current.dnd.moveCard("a", "done", "x"));

    expect(result.current.columns[1].cards.map((item) => [item.id, item.order])).toEqual([
      ["a", 1024],
      ["x", 2048],
    ]);
  });

  it.each([
    ["onto itself", "a", "todo", "a"],
    ["back to its own place", "b", "todo", null],
    ["an unknown card", "nope", "done", null],
    ["into an unknown column", "a", "nowhere", null],
  ])("sends nothing when dropping %s", async (_name, cardId, columnId, before) => {
    const { result } = setup();

    await act(() => result.current.dnd.moveCard(cardId, columnId, before));

    expect(patch).not.toHaveBeenCalled();
    expect(layout(result.current.columns)).toEqual({ todo: ["a", "b"], done: ["x"] });
  });
});
