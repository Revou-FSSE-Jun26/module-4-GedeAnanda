/**
 * Pure helpers for the board's local state: where a dropped card goes and how
 * the columns look afterwards. No React and no network, so they are easy to test.
 */
import type { Card, CardMoveResult, Column, ColumnWithCards, OrderEntry } from "@/types";

export const ORDER_STEP = 1024;

function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order;
}

export function sortColumns(columns: ColumnWithCards[]): ColumnWithCards[] {
  return [...columns].sort(byOrder).map((column) => ({
    ...column,
    cards: [...column.cards].sort(byOrder),
  }));
}

/**
 * The `order` for an item inserted at `index` of a sorted list (the API's FLOAT
 * strategy): 1024 when empty, half of the first at the top, the midpoint
 * between two neighbours, last + 1024 at the end.
 */
export function orderForIndex(items: { order: number }[], index: number): number {
  if (items.length === 0) return ORDER_STEP;
  if (index <= 0) return items[0].order / 2;
  if (index >= items.length) return items[items.length - 1].order + ORDER_STEP;
  return (items[index - 1].order + items[index].order) / 2;
}

export function findCard(columns: ColumnWithCards[], cardId: string): Card | undefined {
  for (const column of columns) {
    const card = column.cards.find((item) => item.id === cardId);
    if (card) return card;
  }
  return undefined;
}

/** Take the card out of wherever it is and put it in `columnId` with `order`. */
export function placeCard(
  columns: ColumnWithCards[],
  cardId: string,
  columnId: string,
  order: number,
): ColumnWithCards[] {
  const card = findCard(columns, cardId);
  if (!card) return columns;
  const moved: Card = { ...card, column_id: columnId, order };
  return columns.map((column) => {
    const others = column.cards.filter((item) => item.id !== cardId);
    return {
      ...column,
      cards: column.id === columnId ? [...others, moved].sort(byOrder) : others,
    };
  });
}

/** Replace a card with a newer copy from the API, wherever it sits; add it if it is new. */
export function upsertCard(columns: ColumnWithCards[], card: Card): ColumnWithCards[] {
  return columns.map((column) => {
    const others = column.cards.filter((item) => item.id !== card.id);
    return {
      ...column,
      cards: column.id === card.column_id ? [...others, card].sort(byOrder) : others,
    };
  });
}

export function removeCard(columns: ColumnWithCards[], cardId: string): ColumnWithCards[] {
  return columns.map((column) => ({
    ...column,
    cards: column.cards.filter((item) => item.id !== cardId),
  }));
}

function applyOrders(cards: Card[], orders: OrderEntry[]): Card[] {
  const next = new Map(orders.map((entry) => [entry.id, entry.order]));
  return cards.map((card) => ({ ...card, order: next.get(card.id) ?? card.order })).sort(byOrder);
}

/** Apply the server's answer to a move: its copy of the card, and new orders after a rebalance. */
export function applyMoveResult(
  columns: ColumnWithCards[],
  result: CardMoveResult,
): ColumnWithCards[] {
  const updated = upsertCard(columns, result.card);
  if (!result.rebalanced) return updated;
  return updated.map((column) =>
    column.id === result.card.column_id
      ? { ...column, cards: applyOrders(column.cards, result.column_orders) }
      : column,
  );
}

/**
 * Put a changed column on the board (REQ-39.2). When its "finished" setting
 * changed, the API has also finished or reopened the column's cards
 * (REQ-39.6, REQ-39.7); do the same to the copies on the page.
 */
export function applyColumnUpdate(
  columns: ColumnWithCards[],
  updated: Column,
  now: Date = new Date(),
): ColumnWithCards[] {
  return columns.map((column) => {
    if (column.id !== updated.id) return column;
    const doneChanged = column.is_done !== updated.is_done;
    const cards = doneChanged
      ? column.cards.map((card) => ({
          ...card,
          completed_at: updated.is_done ? (card.completed_at ?? now.toISOString()) : null,
        }))
      : column.cards;
    return { ...column, ...updated, cards };
  });
}

/** Take a deleted column, and the cards in it, off the board. */
export function removeColumn(columns: ColumnWithCards[], columnId: string): ColumnWithCards[] {
  return columns.filter((column) => column.id !== columnId);
}
