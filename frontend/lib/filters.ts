/**
 * Board filters (REQ-36). Pure functions over the cards already on the page;
 * nothing here talks to the API.
 */

import type { Card, ColumnWithCards, PersonRef, Priority } from "@/types";

export const ANY = "any";
export const NONE = "none";

export type DueFilter = typeof ANY | "overdue" | "week" | typeof NONE;

export interface CardFilters {
  /** `any`, `none` (unassigned) or a user ID. */
  assignee: string;
  priority: typeof ANY | Priority;
  /** `any` or a label ID. */
  label: string;
  due: DueFilter;
}

export const NO_FILTERS: CardFilters = { assignee: ANY, priority: ANY, label: ANY, due: ANY };

/** How many of the four filters are set. */
export function activeFilterCount(filters: CardFilters): number {
  return Object.values(filters).filter((value) => value !== ANY).length;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function matchesDue(card: Card, due: DueFilter, now: Date): boolean {
  if (due === ANY) return true;
  if (due === NONE) return card.due_date === null;
  if (card.due_date === null) return false;
  const today = isoDay(now);
  // A finished card is not late, whatever its date says.
  if (due === "overdue") return card.due_date < today && card.completed_at === null;
  const inAWeek = isoDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  return card.due_date >= today && card.due_date <= inAWeek;
}

/** True when the card passes every filter that is set (REQ-36.2). */
export function matchesFilters(card: Card, filters: CardFilters, now: Date = new Date()): boolean {
  if (filters.assignee === NONE && card.assignee !== null) return false;
  if (filters.assignee !== ANY && filters.assignee !== NONE && card.assignee?.id !== filters.assignee) {
    return false;
  }
  if (filters.priority !== ANY && card.priority !== filters.priority) return false;
  if (filters.label !== ANY && !card.labels.some((label) => label.id === filters.label)) return false;
  return matchesDue(card, filters.due, now);
}

/**
 * The IDs of the cards to show, or `null` when nothing narrows the board.
 * `searchMatches` is the result of the title search (REQ-13); a card must pass
 * both the search and the filters (REQ-36.3).
 */
export function visibleCardIds(
  columns: ColumnWithCards[],
  filters: CardFilters,
  searchMatches: Set<string> | null,
  now: Date = new Date(),
): Set<string> | null {
  if (activeFilterCount(filters) === 0) return searchMatches;
  const visible = new Set<string>();
  for (const column of columns) {
    for (const card of column.cards) {
      if (searchMatches && !searchMatches.has(card.id)) continue;
      if (matchesFilters(card, filters, now)) visible.add(card.id);
    }
  }
  return visible;
}

/** Everyone who has a card on the board, once each, sorted by name. */
export function assigneesOf(columns: ColumnWithCards[]): PersonRef[] {
  const people = new Map<string, PersonRef>();
  for (const column of columns) {
    for (const card of column.cards) {
      if (card.assignee) people.set(card.assignee.id, card.assignee);
    }
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}
