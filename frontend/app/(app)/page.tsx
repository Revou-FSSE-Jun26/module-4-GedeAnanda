import Link from "next/link";

import { CreateBoardModal } from "@/components/board/CreateBoardModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { MARKER_BG, markerFor } from "@/lib/color";
import { formatDate } from "@/lib/format";
import { serverGet } from "@/lib/session";
import type { Board } from "@/types";

/** Dashboard: a Server Component that loads the boards before the page is sent (REQ-26). */
export default async function DashboardPage() {
  const boards = await serverGet<Board[]>("/api/boards");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your boards</h1>
          {boards.length > 0 && (
            <p className="mt-1 text-ink-soft">
              {boards.length === 1 ? "1 board" : `${boards.length} boards`}. Open one to see its cards.
            </p>
          )}
        </div>
        <CreateBoardModal />
      </div>

      {boards.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No boards yet">
            A board holds one project: its columns, and the cards that move across them. Create
            your first one with “New board”.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-rest transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-lift"
              >
                {/* The board's own marker colour, with a small picture of a board drawn on it (REQ-33.5). */}
                <span
                  aria-hidden="true"
                  data-marker={markerFor(board.id)}
                  className={`flex h-20 items-start gap-1.5 px-4 pt-4 ${MARKER_BG[markerFor(board.id)]}`}
                >
                  <span className="h-12 w-7 rounded-md bg-white/30" />
                  <span className="h-8 w-7 rounded-md bg-white/55 transition-transform duration-150 group-hover:-translate-y-1" />
                  <span className="h-10 w-7 rounded-md bg-white/30" />
                </span>
                <span className="flex flex-1 flex-col justify-between gap-3 p-4">
                  <span className="break-words font-display text-lg font-semibold leading-snug">{board.name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-semibold " +
                        (board.role === "admin" ? "bg-action-wash text-action" : "bg-board text-ink-soft")
                      }
                    >
                      {board.role === "admin" ? "Admin" : "Member"}
                    </span>
                    <span>Created {formatDate(board.created_at)}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
