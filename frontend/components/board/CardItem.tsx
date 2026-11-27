"use client";

import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import type { DragAndDrop } from "@/hooks/useDragAndDrop";
import { formatDate, isOverdue } from "@/lib/format";
import type { Card } from "@/types";

interface CardItemProps {
  card: Card;
  dnd: DragAndDrop;
  onOpen: (cardId: string) => void;
}

const EDGE: Record<Card["priority"], string> = {
  low: "border-l-low",
  medium: "border-l-medium",
  high: "border-l-high",
};

/**
 * One card in a column. The whole card can be dragged; dropping another card on
 * it puts that card just above. Its title opens the detail modal.
 */
export function CardItem({ card, dnd, onOpen }: CardItemProps) {
  const overdue = card.due_date && !card.completed_at && isOverdue(card.due_date);

  return (
    <li
      draggable
      data-testid={`card-${card.id}`}
      onDragStart={(event) => dnd.onDragStart(event, card.id)}
      onDragEnd={dnd.onDragEnd}
      onDragOver={dnd.onDragOver}
      onDrop={(event) => dnd.onDrop(event, card.column_id, card.id)}
      className={
        "cursor-grab rounded-md border-l-4 bg-card p-1 shadow-sm active:cursor-grabbing " +
        `${EDGE[card.priority]} ${dnd.draggingId === card.id ? "opacity-40" : ""}`
      }
    >
      <BaseButton
        variant="secondary"
        onClick={() => onOpen(card.id)}
        className="h-auto w-full justify-start whitespace-normal border-transparent px-2 py-2 text-left font-medium leading-snug"
      >
        {card.title}
      </BaseButton>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-2 text-xs text-ink-soft">
        <BaseBadge priority={card.priority} />
        {card.assignee && <span>{card.assignee.name}</span>}
        {card.due_date && (
          <span className={overdue ? "font-semibold text-high" : ""}>
            {overdue ? "Overdue, was due " : "Due "}
            {formatDate(card.due_date)}
          </span>
        )}
      </div>
    </li>
  );
}
