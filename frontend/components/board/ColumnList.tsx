"use client";

import { AddCardForm } from "@/components/board/AddCardForm";
import { CardItem } from "@/components/board/CardItem";
import { Icon } from "@/components/shared/Icon";
import type { DragAndDrop } from "@/hooks/useDragAndDrop";
import type { Card, ColumnWithCards } from "@/types";

interface ColumnListProps {
  columns: ColumnWithCards[];
  /** IDs of the cards that match the active search; `null` when no search is active. */
  matches: Set<string> | null;
  dnd: DragAndDrop;
  onOpenCard: (cardId: string) => void;
  onCardCreated: (card: Card) => void;
}

/** The board's columns in order, each with its cards and its "Add card" action. */
export function ColumnList({ columns, matches, dnd, onOpenCard, onCardCreated }: ColumnListProps) {
  return (
    <>
      {columns.map((column) => {
        const cards = matches ? column.cards.filter((card) => matches.has(card.id)) : column.cards;
        const target = dnd.draggingId !== null && dnd.dropTarget?.columnId === column.id;
        // The card would go to the end of this column, not above another card.
        const landingAtEnd = target && dnd.dropTarget?.beforeCardId === null;
        return (
          <section
            key={column.id}
            aria-label={column.name}
            data-testid={`column-${column.name}`}
            data-drop-target={target ? "true" : undefined}
            onDragOver={(event) => dnd.onDragOver(event, column.id)}
            onDrop={(event) => dnd.onDrop(event, column.id)}
            className={
              "flex max-h-full w-72 shrink-0 flex-col rounded-2xl p-2.5 ring-2 " +
              "transition-[box-shadow,background-color] duration-150 " +
              (target ? "bg-action-wash ring-action" : "bg-lane ring-transparent")
            }
          >
            <h2 className="flex items-center justify-between gap-2 px-1.5 pb-2.5 pt-0.5">
              <span className="flex min-w-0 items-center gap-1.5">
                {column.is_done && (
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-low-wash text-low">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="truncate font-display text-base font-semibold">{column.name}</span>
              </span>
              <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-soft">
                {cards.length}
                <span className="sr-only"> {cards.length === 1 ? "card" : "cards"}</span>
                {column.is_done && <span className="sr-only">, done</span>}
              </span>
            </h2>
            <ul className="flex min-h-16 flex-col gap-2 overflow-y-auto px-0.5 pb-2 pt-1">
              {cards.map((card) => (
                <CardItem key={card.id} card={card} dnd={dnd} onOpen={onOpenCard} />
              ))}
              {landingAtEnd && (
                <li aria-hidden="true" className="h-[3px] shrink-0 rounded-full bg-action" />
              )}
            </ul>
            <AddCardForm column={column} onCreated={onCardCreated} />
          </section>
        );
      })}
    </>
  );
}
