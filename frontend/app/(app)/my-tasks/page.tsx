import Link from "next/link";

import { BaseBadge } from "@/components/shared/BaseBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Icon } from "@/components/shared/Icon";
import { MARKER_BG, markerFor } from "@/lib/color";
import { formatDate, isOverdue } from "@/lib/format";
import { serverGet } from "@/lib/session";
import type { Card } from "@/types";

interface BoardGroup {
  boardId: string;
  boardName: string;
  cards: Card[];
}

function groupByBoard(cards: Card[]): BoardGroup[] {
  const groups = new Map<string, BoardGroup>();
  for (const card of cards) {
    const group = groups.get(card.board_id) ?? {
      boardId: card.board_id,
      boardName: card.board_name,
      cards: [],
    };
    group.cards.push(card);
    groups.set(card.board_id, group);
  }
  return [...groups.values()];
}

/** Every card assigned to the current user, grouped by board (REQ-12.4). */
export default async function MyTasksPage() {
  const cards = await serverGet<Card[]>("/api/cards?assignee=me");
  const groups = groupByBoard(cards);
  const open = cards.filter((card) => !card.completed_at);
  const late = open.filter((card) => card.due_date && isOverdue(card.due_date));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">My tasks</h1>
      {cards.length > 0 && (
        <p className="mt-1 text-ink-soft">
          {open.length} open
          {late.length > 0 && (
            <>
              , <span className="font-semibold text-high">{late.length} overdue</span>
            </>
          )}
          , {cards.length - open.length} done
        </p>
      )}

      {groups.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Nothing is assigned to you">
            When someone assigns you a card, it shows up here. You can also open a card on any of
            your boards and set “Assigned to” to yourself.
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.boardId} aria-labelledby={`board-${group.boardId}`} className="mt-8">
            <h2 id={`board-${group.boardId}`} className="flex items-center gap-2.5 font-display text-xl font-semibold">
              <span
                aria-hidden="true"
                className={`h-5 w-1.5 shrink-0 rounded-full ${MARKER_BG[markerFor(group.boardId)]}`}
              />
              <Link href={`/boards/${group.boardId}`} className="underline-offset-4 hover:underline">
                {group.boardName}
              </Link>
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {group.cards.map((card) => {
                const overdue = card.due_date && !card.completed_at && isOverdue(card.due_date);
                return (
                  <li
                    key={card.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-card p-3 shadow-rest"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 " +
                          (card.completed_at ? "border-low bg-low-wash text-low" : "border-line")
                        }
                      >
                        {card.completed_at && <Icon name="check" className="h-3 w-3" />}
                      </span>
                      <span
                        className={
                          "min-w-0 break-words font-medium " +
                          (card.completed_at ? "text-ink-soft line-through" : "")
                        }
                      >
                        {card.title}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                      {card.completed_at && <span>Done</span>}
                      {card.due_date && (
                        <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-high" : ""}`}>
                          <Icon name="calendar" className="h-3.5 w-3.5" />
                          {overdue ? "Overdue, was due " : "Due "}
                          {formatDate(card.due_date)}
                        </span>
                      )}
                      <BaseBadge priority={card.priority} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
