"use client";

import { useEffect, useState } from "react";

import { AddColumnForm } from "@/components/board/AddColumnForm";
import { AnalyticsModal } from "@/components/board/AnalyticsModal";
import { CardDetailModal } from "@/components/board/CardDetailModal";
import { ColumnList } from "@/components/board/ColumnList";
import { MembersModal } from "@/components/board/MembersModal";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { findCard, removeCard, sortColumns, upsertCard } from "@/lib/board";
import type { BoardDetail, Card, ColumnWithCards } from "@/types";

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
          <MembersModal boardId={board.id} role={board.role} />
          {board.role === "admin" && <AnalyticsModal boardId={board.id} />}
          <AddColumnForm
            boardId={board.id}
            onCreated={(column) => setColumns((current) => [...current, { ...column, cards: [] }])}
          />
        </div>
        {matches && (
          <p role="status" className="w-full text-sm text-ink-soft">
            {matches.size === 0
              ? `No card title contains “${query.trim()}”.`
              : `Showing ${matches.size} matching ${matches.size === 1 ? "card" : "cards"}.`}
          </p>
        )}
      </div>

      {columns.length === 0 ? (
        <div className="mx-auto w-full max-w-6xl px-4">
          <p className="rounded-xl border-2 border-dashed border-line px-5 py-12 text-center text-ink-soft">
            This board has no columns yet. Add one, for example “To Do”, to start placing cards.
          </p>
        </div>
      ) : (
        // The only place in the app that scrolls sideways (guideline FE-08).
        <div className="flex flex-1 items-start gap-3 overflow-x-auto px-4 pb-6">
          <ColumnList
            columns={columns}
            matches={matches}
            dnd={dnd}
            onOpenCard={setOpenCardId}
            onCardCreated={(card) => setColumns((current) => upsertCard(current, card))}
          />
        </div>
      )}

      {openCard && (
        <CardDetailModal
          key={openCard.id}
          card={openCard}
          columns={columns}
          role={board.role}
          onClose={() => setOpenCardId(null)}
          onSaved={(card) => setColumns((current) => upsertCard(current, card))}
          onDeleted={(cardId) => setColumns((current) => removeCard(current, cardId))}
          onMove={(cardId, columnId) => void dnd.moveCard(cardId, columnId)}
        />
      )}
    </>
  );
}
