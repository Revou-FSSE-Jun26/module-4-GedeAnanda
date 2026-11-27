"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { useNotifications } from "@/hooks/useNotifications";
import type { Notification } from "@/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onSelect(notification: Notification) {
    await markRead(notification.id);
    if (notification.board_id) {
      setOpen(false);
      router.push(`/boards/${notification.board_id}`);
    }
  }

  const label =
    unreadCount === 0 ? "Notifications, none unread" : `Notifications, ${unreadCount} unread`;

  return (
    <div ref={containerRef} className="relative">
      <BaseButton
        variant="secondary"
        aria-label={label}
        aria-expanded={open}
        aria-controls="notification-list"
        onClick={() => setOpen((value) => !value)}
        className="relative px-0"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            data-testid="unread-count"
            className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-danger px-1 text-center text-xs font-bold leading-5 text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </BaseButton>

      {open && (
        <div
          id="notification-list"
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-4 top-16 z-40 max-h-[70dvh] overflow-y-auto rounded-xl border border-line bg-card p-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-88"
        >
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-soft">
              Nothing yet. You will hear about new cards, comments and invites here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <BaseButton
                    variant="secondary"
                    onClick={() => onSelect(notification)}
                    className={
                      "h-auto w-full flex-col items-start gap-0.5 border-transparent py-2 text-left font-normal " +
                      (notification.is_read ? "bg-card" : "bg-board")
                    }
                  >
                    <span className={notification.is_read ? "" : "font-semibold"}>
                      {!notification.is_read && <span className="sr-only">Unread: </span>}
                      {notification.message}
                    </span>
                    <span className="text-xs text-ink-soft">{formatTime(notification.created_at)}</span>
                  </BaseButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
