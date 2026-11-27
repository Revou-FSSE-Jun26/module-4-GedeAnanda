"use client";

import { useEffect, useState } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";
import { BaseModal } from "@/components/shared/BaseModal";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import type { Analytics } from "@/types";

/** Board numbers for admins: cards per column, finished this week, and each member's activity. */
export function AnalyticsModal({ boardId }: { boardId: string }) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    const controller = new AbortController();
    apiClient
      .get<Analytics>(`/api/boards/${boardId}/analytics`, { token, signal: controller.signal })
      .then(setData)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) handleError(caught);
      });
    return () => controller.abort();
  }, [open, token, boardId, handleError]);

  const most = Math.max(1, ...(data?.cards_per_column.map((column) => column.count) ?? []));

  return (
    <>
      <BaseButton variant="secondary" onClick={() => setOpen(true)}>
        <Icon name="chart" className="h-4 w-4" />
        Analytics
      </BaseButton>
      <BaseModal open={open} title="Board analytics" onClose={() => setOpen(false)}>
        {!data ? (
          <p className="text-ink-soft">Loading the numbers…</p>
        ) : (
          <div className="flex flex-col gap-6">
            <p>
              <span className="font-display text-4xl font-semibold">{data.completed_this_week}</span>{" "}
              <span className="text-ink-soft">
                {data.completed_this_week === 1 ? "card" : "cards"} finished since Monday
              </span>
            </p>

            <section aria-labelledby="per-column-heading">
              <h3 id="per-column-heading" className="mb-2 font-semibold">
                Cards in each column
              </h3>
              {data.cards_per_column.length === 0 ? (
                <p className="text-sm text-ink-soft">This board has no columns yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.cards_per_column.map((column) => (
                    <li key={column.column_id} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm">
                      <span className="truncate">{column.column_name}</span>
                      <progress
                        value={column.count}
                        max={most}
                        aria-label={`${column.column_name}: ${column.count} of the largest column's ${most}`}
                        className="h-3 w-full appearance-none overflow-hidden rounded-full bg-board [&::-moz-progress-bar]:bg-action [&::-webkit-progress-bar]:bg-board [&::-webkit-progress-value]:bg-action"
                      />
                      <span className="text-right font-semibold tabular-nums">{column.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="activity-heading">
              <h3 id="activity-heading" className="mb-2 font-semibold">
                Member activity
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-ink-soft">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-medium">Member</th>
                      <th scope="col" className="px-2 py-1 text-right font-medium">Created</th>
                      <th scope="col" className="px-2 py-1 text-right font-medium">Assigned</th>
                      <th scope="col" className="py-1 pl-2 text-right font-medium">Comments, 7 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.member_activity.map((member) => (
                      <tr key={member.user_id} className="border-t border-line">
                        <th scope="row" className="py-2 pr-3 font-semibold">{member.name}</th>
                        <td className="px-2 py-2 text-right tabular-nums">{member.cards_created}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{member.cards_assigned}</td>
                        <td className="py-2 pl-2 text-right tabular-nums">{member.comments_last_7_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </BaseModal>
    </>
  );
}
