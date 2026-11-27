import {
  ANY,
  NONE,
  NO_FILTERS,
  activeFilterCount,
  assigneesOf,
  matchesFilters,
  visibleCardIds,
  type CardFilters,
} from "@/lib/filters";
import type { Card, ColumnWithCards } from "@/types";

const NOW = new Date("2026-11-27T10:00:00Z");
const MAYA = { id: "maya", name: "Maya" };
const RIZKY = { id: "rizky", name: "Rizky" };
const BUG = { id: "bug", name: "Bug", color: "poppy" as const };
const DESIGN = { id: "design", name: "Design", color: "plum" as const };

function card(id: string, changes: Partial<Card> = {}): Card {
  return {
    id,
    column_id: "todo",
    board_id: "board",
    board_name: "Sprint",
    title: `Card ${id}`,
    description: null,
    priority: "medium",
    due_date: null,
    order: 1024,
    completed_at: null,
    created_by: "maya",
    assignee: null,
    labels: [],
    checklist: [],
    ...changes,
  };
}

function column(id: string, cards: Card[]): ColumnWithCards {
  return { id, board_id: "board", name: id, order: 1024, is_done: false, cards };
}

const only = (change: Partial<CardFilters>): CardFilters => ({ ...NO_FILTERS, ...change });

// REQ-36
describe("matchesFilters", () => {
  it("lets every card through when no filter is set", () => {
    expect(matchesFilters(card("a"), NO_FILTERS, NOW)).toBe(true);
  });

  it("filters by a specific assignee", () => {
    const filters = only({ assignee: "maya" });

    expect(matchesFilters(card("a", { assignee: MAYA }), filters, NOW)).toBe(true);
    expect(matchesFilters(card("b", { assignee: RIZKY }), filters, NOW)).toBe(false);
    expect(matchesFilters(card("c"), filters, NOW)).toBe(false);
  });

  it("filters for cards nobody is assigned to", () => {
    const filters = only({ assignee: NONE });

    expect(matchesFilters(card("a"), filters, NOW)).toBe(true);
    expect(matchesFilters(card("b", { assignee: MAYA }), filters, NOW)).toBe(false);
  });

  it("filters by priority", () => {
    const filters = only({ priority: "high" });

    expect(matchesFilters(card("a", { priority: "high" }), filters, NOW)).toBe(true);
    expect(matchesFilters(card("b", { priority: "low" }), filters, NOW)).toBe(false);
  });

  it("filters by label, also when the card has other labels too", () => {
    const filters = only({ label: "bug" });

    expect(matchesFilters(card("a", { labels: [BUG, DESIGN] }), filters, NOW)).toBe(true);
    expect(matchesFilters(card("b", { labels: [DESIGN] }), filters, NOW)).toBe(false);
    expect(matchesFilters(card("c"), filters, NOW)).toBe(false);
  });

  it("treats a card due yesterday as overdue, and one due today as not", () => {
    const filters = only({ due: "overdue" });

    expect(matchesFilters(card("a", { due_date: "2026-11-26" }), filters, NOW)).toBe(true);
    expect(matchesFilters(card("b", { due_date: "2026-11-27" }), filters, NOW)).toBe(false);
    expect(matchesFilters(card("c"), filters, NOW)).toBe(false);
  });

  it("does not call a finished card overdue", () => {
    const finished = card("a", { due_date: "2026-11-01", completed_at: "2026-11-02T08:00:00Z" });

    expect(matchesFilters(finished, only({ due: "overdue" }), NOW)).toBe(false);
  });

  it("counts today and the seventh day as the next 7 days, and nothing outside", () => {
    const filters = only({ due: "week" });

    expect(matchesFilters(card("a", { due_date: "2026-11-27" }), filters, NOW)).toBe(true);
    expect(matchesFilters(card("b", { due_date: "2026-12-04" }), filters, NOW)).toBe(true);
    expect(matchesFilters(card("c", { due_date: "2026-12-05" }), filters, NOW)).toBe(false);
    expect(matchesFilters(card("d", { due_date: "2026-11-26" }), filters, NOW)).toBe(false);
  });

  it("filters for cards without a due date", () => {
    const filters = only({ due: NONE });

    expect(matchesFilters(card("a"), filters, NOW)).toBe(true);
    expect(matchesFilters(card("b", { due_date: "2026-12-01" }), filters, NOW)).toBe(false);
  });

  it("needs every filter that is set to match", () => {
    const filters = only({ assignee: "maya", priority: "high", label: "bug" });
    const match = card("a", { assignee: MAYA, priority: "high", labels: [BUG] });

    expect(matchesFilters(match, filters, NOW)).toBe(true);
    expect(matchesFilters({ ...match, priority: "low" }, filters, NOW)).toBe(false);
    expect(matchesFilters({ ...match, labels: [] }, filters, NOW)).toBe(false);
    expect(matchesFilters({ ...match, assignee: RIZKY }, filters, NOW)).toBe(false);
  });
});

describe("visibleCardIds", () => {
  const columns = [
    column("todo", [card("a", { priority: "high" }), card("b", { priority: "low" })]),
    column("done", [card("c", { priority: "high" })]),
  ];

  it("returns null when neither a search nor a filter narrows the board", () => {
    expect(visibleCardIds(columns, NO_FILTERS, null, NOW)).toBeNull();
  });

  it("passes the search result through when no filter is set", () => {
    const found = new Set(["b"]);

    expect(visibleCardIds(columns, NO_FILTERS, found, NOW)).toBe(found);
  });

  it("collects matching cards from every column", () => {
    expect(visibleCardIds(columns, only({ priority: "high" }), null, NOW)).toEqual(new Set(["a", "c"]));
  });

  it("shows only cards that pass both the search and the filters", () => {
    const found = new Set(["a", "b"]);

    expect(visibleCardIds(columns, only({ priority: "high" }), found, NOW)).toEqual(new Set(["a"]));
  });

  it("returns an empty set, not null, when a filter matches nothing", () => {
    expect(visibleCardIds(columns, only({ label: "bug" }), null, NOW)).toEqual(new Set());
  });
});

describe("activeFilterCount", () => {
  it("counts only the filters that are set", () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount(only({ priority: "low", due: NONE }))).toBe(2);
    expect(activeFilterCount(only({ assignee: ANY }))).toBe(0);
  });
});

describe("assigneesOf", () => {
  it("lists each person once, sorted by name, and skips unassigned cards", () => {
    const columns = [
      column("todo", [card("a", { assignee: RIZKY }), card("b"), card("c", { assignee: MAYA })]),
      column("done", [card("d", { assignee: RIZKY })]),
    ];

    expect(assigneesOf(columns)).toEqual([MAYA, RIZKY]);
  });
});
