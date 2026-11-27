"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/shared/Icon";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { completionTarget } from "@/lib/tasks";
import { toast } from "@/lib/toast";
import type { BoardDetail, Card, CardMoveResult } from "@/types";

const NO_DONE_COLUMN =
  "This board has no column for finished cards. Add one on the board and tick “Cards moved here are finished”.";
const NO_OPEN_COLUMN = "This board has no column for unfinished cards. Add one on the board first.";

/**
 * The checkbox in front of a task on My Tasks (REQ-38). Ticking it moves the
 * card to the board's first "done" column; unticking moves it back to the first
 * column that is not. The box changes at once and is put back if the move fails
 * (guideline FE-07).
 */
export function TaskCheck({ card }: { card: Pick<Card, "id" | "board_id" | "title" | "completed_at"> }) {
  const router = useRouter();
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [done, setDone] = useState(card.completed_at !== null);
  const [busy, setBusy] = useState(false);

  async function onChange(next: boolean) {
    const previous = done;
    setDone(next);
    setBusy(true);
    try {
      const board = await apiClient.get<BoardDetail>(`/api/boards/${card.board_id}`, { token });
      const target = completionTarget(board.columns, next);
      if (!target) {
        setDone(previous);
        toast.error(next ? NO_DONE_COLUMN : NO_OPEN_COLUMN);
        return;
      }
      await apiClient.patch<CardMoveResult>(
        `/api/cards/${card.id}/position`,
        { column_id: target.columnId, order: target.order },
        { token },
      );
      router.refresh(); // the summary line and the "Done" mark come from the server
    } catch (error) {
      setDone(previous);
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="relative -m-3 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={done}
        disabled={busy}
        onChange={(event) => void onChange(event.target.checked)}
        aria-label={`Mark “${card.title}” as done`}
        className={
          "peer h-5 w-5 cursor-pointer appearance-none rounded-full border-2 transition-colors " +
          "border-line hover:border-low checked:border-low checked:bg-low-wash disabled:cursor-wait"
        }
      />
      <Icon
        name="check"
        className="pointer-events-none absolute h-3 w-3 text-low opacity-0 peer-checked:opacity-100"
      />
    </label>
  );
}
