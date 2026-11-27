import Link from "next/link";

import { BaseBadge } from "@/components/shared/BaseBadge";
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

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">My tasks</h1>

      {groups.length === 0 ? (
        <p className="mt-8 rounded-xl border-2 border-dashed border-line px-5 py-12 text-center text-ink-soft">
          Nothing is assigned to you. When someone assigns you a card, it shows up here.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.boardId} aria-labelledby={`board-${group.boardId}`} className="mt-8">
            <h2 id={`board-${group.boardId}`} className="font-display text-xl font-semibold">
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
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-card p-3 shadow-sm"
                  >
                    <span className="min-w-0 break-words font-medium">{card.title}</span>
                    <span className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                      {card.completed_at && <span>Done</span>}
                      {card.due_date && (
                        <span className={overdue ? "font-semibold text-high" : ""}>
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
