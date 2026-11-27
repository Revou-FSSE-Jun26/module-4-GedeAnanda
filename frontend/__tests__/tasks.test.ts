import { completionTarget } from "@/lib/tasks";
import type { Card, ColumnWithCards } from "@/types";

function column(id: string, order: number, is_done: boolean, cardOrders: number[] = []): ColumnWithCards {
  return {
    id,
    board_id: "board",
    name: id,
    order,
    is_done,
    cards: cardOrders.map((cardOrder, index) => ({ id: `${id}-${index}`, order: cardOrder }) as Card),
  };
}

// REQ-38.2 to REQ-38.4
describe("completionTarget", () => {
  it("sends a finished card to the end of the done column", () => {
    const columns = [column("todo", 1024, false, [1024]), column("done", 2048, true, [1024, 3072])];

    expect(completionTarget(columns, true)).toEqual({ columnId: "done", order: 4096 });
  });

  it("starts an empty column at 1024", () => {
    const columns = [column("todo", 1024, false), column("done", 2048, true)];

    expect(completionTarget(columns, true)).toEqual({ columnId: "done", order: 1024 });
  });

  it("sends a reopened card to the first column that is not done", () => {
    const columns = [column("done", 3072, true), column("doing", 2048, false, [500]), column("todo", 1024, false, [1024])];

    expect(completionTarget(columns, false)).toEqual({ columnId: "todo", order: 2048 });
  });

  it("picks the first done column by position on the board, not by position in the list", () => {
    const columns = [column("archive", 4096, true), column("done", 2048, true), column("todo", 1024, false)];

    expect(completionTarget(columns, true)?.columnId).toBe("done");
  });

  it("returns null when the board has no done column", () => {
    expect(completionTarget([column("todo", 1024, false)], true)).toBeNull();
  });

  it("returns null when every column is a done column", () => {
    expect(completionTarget([column("done", 1024, true)], false)).toBeNull();
  });
});
