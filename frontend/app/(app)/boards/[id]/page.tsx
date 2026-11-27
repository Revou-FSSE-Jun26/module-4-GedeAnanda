import Link from "next/link";

import { KanbanBoard } from "@/components/board/KanbanBoard";
import { serverGet } from "@/lib/session";
import type { BoardDetail } from "@/types";

/** Board detail: a Server Component that loads the board, with `KanbanBoard` as its client island. */
export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const { id } = await params;
  const board = await serverGet<BoardDetail>(`/api/boards/${encodeURIComponent(id)}`);

  return (
    <main className="flex min-h-0 flex-1 flex-col pt-6">
      <div className="mx-auto w-full max-w-6xl px-4 pb-4">
        <Link href="/" className="text-sm font-semibold text-action underline underline-offset-4">
          All boards
        </Link>
        <h1 className="mt-1 break-words font-display text-3xl font-semibold tracking-tight">
          {board.name}
        </h1>
      </div>
      <KanbanBoard key={board.id} board={board} />
    </main>
  );
}
