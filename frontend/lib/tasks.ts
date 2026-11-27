/** Finishing and reopening a card from the My Tasks page (REQ-38). */

import type { ColumnWithCards } from "@/types";

export interface MoveTarget {
  columnId: string;
  order: number;
}

/**
 * Where a card goes when it is ticked (`done`) or unticked: the end of the
 * board's first column of the right kind. `null` when the board has no such column.
 */
export function completionTarget(columns: ColumnWithCards[], done: boolean): MoveTarget | null {
  const column = [...columns]
    .sort((a, b) => a.order - b.order)
    .find((candidate) => candidate.is_done === done);
  if (!column) return null;
  const last = Math.max(0, ...column.cards.map((card) => card.order));
  return { columnId: column.id, order: last + 1024 };
}
