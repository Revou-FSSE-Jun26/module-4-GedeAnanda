import {
  applyMoveResult,
  orderForIndex,
  placeCard,
  removeCard,
  sortColumns,
  upsertCard,
} from "@/lib/board";
import type { Card, ColumnWithCards } from "@/types";

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
  };
}

function column(id: string, order: number, cards: Card[]): ColumnWithCards {
  return { id, board_id: "board", name: id, order, is_done: id === "done", cards };
}

function titles(columns: ColumnWithCards[]): Record<string, string[]> {
  return Object.fromEntries(columns.map((item) => [item.id, item.cards.map((c) => c.id)]));
}

const board = () => [
  column("todo", 1024, [card("a", "todo", 1024), card("b", "todo", 2048), card("c", "todo", 3072)]),
  column("done", 2048, [card("x", "done", 1024)]),
];

describe("orderForIndex", () => {
  const items = [{ order: 1024 }, { order: 2048 }, { order: 3072 }];

  it.each([
    ["an empty list", [], 0, 1024],
    ["the top", items, 0, 512],
    ["between the first two", items, 1, 1536],
    ["between the last two", items, 2, 2560],
    ["the end", items, 3, 4096],
    ["an index past the end", items, 99, 4096],
  ])("gives the API's order for %s", (_name, list, index, expected) => {
    expect(orderForIndex(list, index)).toBe(expected);
  });

  it("always lands strictly between its neighbours", () => {
    for (let index = 1; index < items.length; index += 1) {
      const order = orderForIndex(items, index);
      expect(order).toBeGreaterThan(items[index - 1].order);
      expect(order).toBeLessThan(items[index].order);
    }
  });
});

describe("board state helpers", () => {
  it("sortColumns orders columns and their cards without changing the input", () => {
    const input = [
      column("done", 2048, []),
      column("todo", 1024, [card("b", "todo", 2048), card("a", "todo", 1024)]),
    ];

    const sorted = sortColumns(input);

    expect(titles(sorted)).toEqual({ todo: ["a", "b"], done: [] });
    expect(input[0].id).toBe("done");
  });

  it("placeCard moves a card to another column at the given order", () => {
    const next = placeCard(board(), "b", "done", 512);

    expect(titles(next)).toEqual({ todo: ["a", "c"], done: ["b", "x"] });
    expect(next[1].cards[0]).toMatchObject({ id: "b", column_id: "done", order: 512 });
  });

  it("placeCard reorders inside one column", () => {
    expect(titles(placeCard(board(), "c", "todo", 512))).toEqual({ todo: ["c", "a", "b"], done: ["x"] });
  });

  it("placeCard leaves the board alone for an unknown card", () => {
    const before = board();

    expect(placeCard(before, "nope", "done", 1)).toBe(before);
  });

  it("upsertCard replaces an existing card and adds a new one", () => {
    const renamed = { ...card("a", "todo", 1024), title: "Renamed" };
    const added = card("n", "done", 2048);

    const next = upsertCard(upsertCard(board(), renamed), added);

    expect(next[0].cards[0].title).toBe("Renamed");
    expect(titles(next)).toEqual({ todo: ["a", "b", "c"], done: ["x", "n"] });
  });

  it("removeCard takes the card out", () => {
    expect(titles(removeCard(board(), "b"))).toEqual({ todo: ["a", "c"], done: ["x"] });
  });

  it("applyMoveResult takes the server's copy of the card", () => {
    const moved = { ...card("a", "done", 2048), completed_at: "2026-11-27T08:00:00+00:00" };

    const next = applyMoveResult(placeCard(board(), "a", "done", 2048), {
      card: moved,
      rebalanced: false,
      column_orders: [],
    });

    expect(titles(next)).toEqual({ todo: ["b", "c"], done: ["x", "a"] });
    expect(next[1].cards[1].completed_at).toBe("2026-11-27T08:00:00+00:00");
  });

  it("applyMoveResult applies the new orders after a rebalance, only to that column", () => {
    const next = applyMoveResult(placeCard(board(), "c", "todo", 1024.0000001), {
      card: card("c", "todo", 2048),
      rebalanced: true,
      column_orders: [
        { id: "a", order: 1024 },
        { id: "c", order: 2048 },
        { id: "b", order: 3072 },
      ],
    });

    expect(next[0].cards.map((item) => [item.id, item.order])).toEqual([
      ["a", 1024],
      ["c", 2048],
      ["b", 3072],
    ]);
    expect(next[1].cards[0].order).toBe(1024);
  });
});
