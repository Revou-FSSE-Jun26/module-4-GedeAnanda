"use client";

import { useCallback, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";

import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { applyMoveResult, findCard, orderForIndex, placeCard } from "@/lib/board";
import type { CardMoveResult, ColumnWithCards } from "@/types";

/**
 * Card moves with the native HTML5 Drag and Drop API (no library).
 *
 * A move is optimistic (guideline FE-07): the board changes at once, the
 * request follows, and a failed request puts the board back as it was.
 */
export function useDragAndDrop(
  columns: ColumnWithCards[],
  setColumns: Dispatch<SetStateAction<ColumnWithCards[]>>,
) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /** Move a card into a column, before `beforeCardId`, or to the end when that is null. */
  const moveCard = useCallback(
    async (cardId: string, columnId: string, beforeCardId: string | null = null) => {
      const card = findCard(columns, cardId);
      const target = columns.find((column) => column.id === columnId);
      if (!card || !target || beforeCardId === cardId) return;

      const siblings = target.cards.filter((item) => item.id !== cardId);
      const found = beforeCardId ? siblings.findIndex((item) => item.id === beforeCardId) : -1;
      const index = found === -1 ? siblings.length : found;
      const currentIndex = target.cards.findIndex((item) => item.id === cardId);
      if (card.column_id === columnId && currentIndex === index) return; // dropped where it was

      const order = orderForIndex(siblings, index);
      const snapshot = columns;
      setColumns(placeCard(columns, cardId, columnId, order));
      try {
        const result = await apiClient.patch<CardMoveResult>(
          `/api/cards/${cardId}/position`,
          { column_id: columnId, order },
          { token },
        );
        setColumns((current) => applyMoveResult(current, result));
      } catch (error) {
        setColumns(snapshot);
        handleError(error);
      }
    },
    [columns, setColumns, token, handleError],
  );

  const onDragStart = useCallback((event: DragEvent, cardId: string) => {
    event.dataTransfer.setData("text/plain", cardId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(cardId);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault(); // marks the element as a place a card can be dropped
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent, columnId: string, beforeCardId: string | null = null) => {
      event.preventDefault();
      event.stopPropagation(); // a drop on a card must not also count as a drop on its column
      const cardId = event.dataTransfer.getData("text/plain") || draggingId;
      setDraggingId(null);
      if (cardId) void moveCard(cardId, columnId, beforeCardId);
    },
    [draggingId, moveCard],
  );

  const onDragEnd = useCallback(() => setDraggingId(null), []);

  return { draggingId, moveCard, onDragStart, onDragOver, onDrop, onDragEnd };
}

export type DragAndDrop = ReturnType<typeof useDragAndDrop>;
