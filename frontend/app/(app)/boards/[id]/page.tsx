import Link from "next/link";

import { KanbanBoard } from "@/components/board/KanbanBoard";
import { MARKER_BG, markerFor } from "@/lib/color";
import { serverGet } from "@/lib/session";
import type { BoardDetail } from "@/types";

/** Board detail: a Server Component that loads the board, with `KanbanBoard` as its client island. */
export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const { id } = await params;
  const board = await serverGet<BoardDetail>(`/api/boards/${encodeURIComponent(id)}`);

  return (
    <main className="flex min-h-0 flex-1 flex-col pt-6">
      <div className="mx-auto w-full max-w-6xl px-4 pb-5">
        <Link href="/" className="text-sm font-semibold text-action underline underline-offset-4">
          All boards
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {/* The same marker colour this board has on the dashboard (REQ-33.5). */}
          <span
            aria-hidden="true"
            data-marker={markerFor(board.id)}
            className={`h-9 w-2.5 shrink-0 rounded-full ${MARKER_BG[markerFor(board.id)]}`}
          />
          <h1 className="min-w-0 break-words font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {board.name}
          </h1>
        </div>
      </div>
      <KanbanBoard key={board.id} board={board} />
    </main>
  );
}
