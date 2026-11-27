"use client";

import { Avatar } from "@/components/shared/Avatar";
import { BaseBadge } from "@/components/shared/BaseBadge";
import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";
import { LabelChip } from "@/components/shared/LabelChip";
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
  const dragging = dnd.draggingId === card.id;
  // Another card is in the air and would land just above this one.
  const stepsDone = card.checklist.filter((item) => item.is_done).length;
  const allStepsDone = card.checklist.length > 0 && stepsDone === card.checklist.length;
  const landingAbove = dnd.draggingId !== null && !dragging && dnd.dropTarget?.beforeCardId === card.id;

  return (
    <li
      draggable
      data-testid={`card-${card.id}`}
      data-dragging={dragging ? "true" : undefined}
      data-landing={landingAbove ? "true" : undefined}
      onDragStart={(event) => dnd.onDragStart(event, card.id)}
      onDragEnd={dnd.onDragEnd}
      onDragOver={(event) => dnd.onDragOver(event, card.column_id, card.id)}
      onDrop={(event) => dnd.onDrop(event, card.column_id, card.id)}
      className={
        "group relative cursor-grab rounded-lg border-l-4 bg-card p-1 shadow-rest " +
        "transition-[box-shadow,transform,opacity] duration-150 hover:shadow-lift active:cursor-grabbing " +
        // The insertion mark is drawn outside the card's box, so nothing moves under the pointer.
        "before:pointer-events-none before:absolute before:inset-x-0 before:-top-[5px] before:h-[3px] " +
        "before:rounded-full before:bg-action before:opacity-0 data-[landing=true]:before:opacity-100 " +
        "data-[dragging=true]:rotate-2 data-[dragging=true]:opacity-45 data-[dragging=true]:shadow-lift " +
        EDGE[card.priority]
      }
    >
      {card.labels.length > 0 && (
        <ul aria-label="Labels" className="flex flex-wrap gap-1 px-2 pt-2">
          {card.labels.map((label) => (
            <li key={label.id} className="flex max-w-full">
              <LabelChip label={label} />
            </li>
          ))}
        </ul>
      )}
      <BaseButton
        variant="secondary"
        onClick={() => onOpen(card.id)}
        className="h-auto w-full justify-start whitespace-normal border-transparent! bg-transparent! px-2 py-2 text-left font-medium leading-snug group-hover:text-action"
      >
        {card.title}
      </BaseButton>
      <div className="flex items-center gap-2 px-2 pb-2 text-xs text-ink-soft">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          <BaseBadge priority={card.priority} />
          {card.due_date && (
            <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-high" : ""}`}>
              <Icon name="calendar" className="h-3.5 w-3.5" />
              <span>
                {overdue ? "Overdue, was due " : "Due "}
                {formatDate(card.due_date)}
              </span>
            </span>
          )}
          {card.checklist.length > 0 && (
            <span
              data-complete={allStepsDone ? "true" : undefined}
              className={
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 tabular-nums " +
                (allStepsDone ? "bg-low-wash font-semibold text-low" : "")
              }
            >
              <Icon name="check" className="h-3.5 w-3.5" />
              <span className="sr-only">Checklist: </span>
              {stepsDone}/{card.checklist.length}
              <span className="sr-only"> done</span>
            </span>
          )}
        </div>
        {card.assignee && (
          <span className="inline-flex shrink-0 items-center">
            <span className="sr-only">Assigned to </span>
            <Avatar id={card.assignee.id} name={card.assignee.name} size="sm" />
          </span>
        )}
      </div>
    </li>
  );
}
