"use client";

import { useEffect, useMemo, useState } from "react";

import { AddColumnForm } from "@/components/board/AddColumnForm";
import { AnalyticsModal } from "@/components/board/AnalyticsModal";
import { BoardFilters } from "@/components/board/BoardFilters";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { ColumnList } from "@/components/board/ColumnList";
import { MembersModal } from "@/components/board/MembersModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import {
  applyColumnUpdate,
  findCard,
  removeCard,
  removeColumn,
  sortColumns,
  upsertCard,
} from "@/lib/board";
import { NO_FILTERS, activeFilterCount, assigneesOf, visibleCardIds, type CardFilters } from "@/lib/filters";
import type { BoardDetail, Card, ColumnWithCards, Label } from "@/types";

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The interactive part of the board page: owns the columns' state, card moves,
 * the card search and the open card. The page around it is a Server Component.
 */
export function KanbanBoard({ board }: { board: BoardDetail }) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [columns, setColumns] = useState<ColumnWithCards[]>(() => sortColumns(board.columns));
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Set<string> | null>(null);
  const [labels, setLabels] = useState<Label[]>(board.labels);
  const [filters, setFilters] = useState<CardFilters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const dnd = useDragAndDrop(columns, setColumns);

  // Card search: wait 300 ms after the last keystroke, then ask the API (REQ-13.2, REQ-27.6).
  useEffect(() => {
    const term = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        if (!term) {
          setMatches(null);
          return;
        }
        try {
          const found = await apiClient.get<Card[]>(
            `/api/cards?board_id=${board.id}&q=${encodeURIComponent(term)}`,
            { token, signal: controller.signal },
          );
          setMatches(new Set(found.map((card) => card.id)));
        } catch (error) {
          if (!controller.signal.aborted) handleError(error);
        }
      },
      term ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, board.id, token, handleError]);

  const openCard = openCardId ? findCard(columns, openCardId) : undefined;
  const filterCount = activeFilterCount(filters);
  // The cards to show: those that pass the search and every filter that is set (REQ-36.3).
  const visible = useMemo(() => visibleCardIds(columns, filters, matches), [columns, filters, matches]);
  const people = useMemo(() => assigneesOf(columns), [columns]);

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end gap-3 px-4 pb-4">
        <div className="w-full sm:w-64">
          <TextField
            id="card-search"
            label="Search cards"
            type="search"
            value={query}
            onChange={setQuery}
            placeholder="Type part of a title"
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <BaseButton
            variant="secondary"
            onClick={() => setShowFilters((shown) => !shown)}
            aria-expanded={showFilters}
            aria-controls="board-filters"
            className={filterCount > 0 ? "border-action! text-action" : ""}
          >
            <Icon name="filter" className="h-4 w-4" />
            Filters
            {filterCount > 0 && (
              <span className="rounded-full bg-action px-1.5 text-xs font-bold text-on-action">
                {filterCount}
                <span className="sr-only"> set</span>
              </span>
            )}
          </BaseButton>
          <MembersModal boardId={board.id} role={board.role} />
          {board.role === "admin" && <AnalyticsModal boardId={board.id} />}
          <AddColumnForm
            boardId={board.id}
            onCreated={(column) => setColumns((current) => [...current, { ...column, cards: [] }])}
          />
        </div>
        {showFilters && (
          <BoardFilters filters={filters} onChange={setFilters} people={people} labels={labels} />
        )}
        {filterCount > 0 && visible ? (
          <p role="status" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            {visible.size === 0
              ? "No card matches these filters."
              : `Showing ${visible.size} matching ${visible.size === 1 ? "card" : "cards"}.`}
            {!showFilters && (
              <BaseButton variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                Clear filters
              </BaseButton>
            )}
          </p>
        ) : (
          matches && (
            <p role="status" className="w-full text-sm text-ink-soft">
              {matches.size === 0
                ? `No card title contains “${query.trim()}”.`
                : `Showing ${matches.size} matching ${matches.size === 1 ? "card" : "cards"}.`}
            </p>
          )
        )}
      </div>

      {columns.length === 0 ? (
        <div className="mx-auto w-full max-w-6xl px-4">
          <EmptyState title="This board has no columns yet">
            Columns are the stages work moves through. Add the first one, for example “To Do”, with
            “Add column”.
          </EmptyState>
        </div>
      ) : (
        // The only place in the app that scrolls sideways (guideline FE-08). `relative` keeps
        // absolutely positioned children (screen-reader-only text) inside the scroll area;
        // without it they widen the whole page.
        // The strip runs edge to edge so columns can scroll under the screen's edges, but its
        // padding grows on wide screens so the first column lines up with the page's 72rem
        // content column (the title and the toolbar above it).
        <div className="relative flex flex-1 items-start gap-3 overflow-x-auto px-[max(1rem,calc((100vw-72rem)/2+1rem))] pb-6 pt-1">
          <ColumnList
            columns={columns}
            matches={visible}
            dnd={dnd}
            role={board.role}
            onOpenCard={setOpenCardId}
            onColumnUpdated={(column) => setColumns((current) => applyColumnUpdate(current, column))}
            onColumnDeleted={(columnId) => setColumns((current) => removeColumn(current, columnId))}
            onCardCreated={(card) => setColumns((current) => upsertCard(current, card))}
          />
        </div>
      )}

      {openCard && (
        <CardDetailModal
          key={openCard.id}
          card={openCard}
          columns={columns}
          labels={labels}
          role={board.role}
          onClose={() => setOpenCardId(null)}
          onSaved={(card) => setColumns((current) => upsertCard(current, card))}
          onLabelCreated={(label) =>
            setLabels((current) => [...current, label].sort((a, b) => a.name.localeCompare(b.name)))
          }
          onDeleted={(cardId) => setColumns((current) => removeCard(current, cardId))}
          onMove={(cardId, columnId) => void dnd.moveCard(cardId, columnId)}
        />
      )}
    </>
  );
}
