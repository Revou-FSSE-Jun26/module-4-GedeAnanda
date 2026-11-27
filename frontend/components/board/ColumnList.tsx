"use client";

import { AddCardForm } from "@/components/board/AddCardForm";
import { CardItem } from "@/components/board/CardItem";
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
        return (
          <section
            key={column.id}
            aria-label={column.name}
            data-testid={`column-${column.name}`}
            onDragOver={dnd.onDragOver}
            onDrop={(event) => dnd.onDrop(event, column.id)}
            className="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-lane p-2.5"
          >
            <h2 className="flex items-baseline justify-between gap-2 px-1 pb-2">
              <span className="font-display text-base font-semibold">{column.name}</span>
              <span className="text-sm text-ink-soft">
                {cards.length}
                <span className="sr-only"> {cards.length === 1 ? "card" : "cards"}</span>
                {column.is_done && ", done"}
              </span>
            </h2>
            <ul className="flex min-h-16 flex-col gap-2 overflow-y-auto pb-2">
              {cards.map((card) => (
                <CardItem key={card.id} card={card} dnd={dnd} onOpen={onOpenCard} />
              ))}
            </ul>
            <AddCardForm column={column} onCreated={onCardCreated} />
          </section>
        );
      })}
    </>
  );
}
