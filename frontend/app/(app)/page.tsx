import Link from "next/link";

import { CreateBoardModal } from "@/components/board/CreateBoardModal";
import { formatDate } from "@/lib/format";
import { serverGet } from "@/lib/session";
import type { Board } from "@/types";

/** Dashboard: a Server Component that loads the boards before the page is sent (REQ-26). */
export default async function DashboardPage() {
  const boards = await serverGet<Board[]>("/api/boards");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your boards</h1>
        <CreateBoardModal />
      </div>

      {boards.length === 0 ? (
        <div className="mt-8 rounded-xl border-2 border-dashed border-line px-5 py-12 text-center">
          <p className="font-display text-xl font-semibold">No boards yet</p>
          <p className="mx-auto mt-2 max-w-sm text-ink-soft">
            A board holds one project: its columns, and the cards that move across them. Create
            your first one with “New board”.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                className="flex min-h-28 flex-col justify-between rounded-xl border-l-4 border-action bg-card p-4 shadow-sm hover:shadow-md"
              >
                <span className="font-display text-lg font-semibold leading-snug">{board.name}</span>
                <span className="mt-3 text-sm text-ink-soft">
                  {board.role === "admin" ? "You are an admin" : "You are a member"}, created{" "}
                  {formatDate(board.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
