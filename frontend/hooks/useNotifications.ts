"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import type { Notification, NotificationPage } from "@/types";

export const POLL_INTERVAL_MS = 30_000;

/**
 * The signed-in user's latest notifications, refreshed every 30 seconds while
 * the component is mounted and a token exists.
 */
export function useNotifications() {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // A poll that keeps failing (offline, API down) is reported once, not every 30 seconds.
  const failing = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const page = await apiClient.get<NotificationPage>("/api/notifications", { token });
      failing.current = false;
      setNotifications(page.items);
      setUnreadCount(page.unread_count);
    } catch (error) {
      if (!failing.current) handleError(error);
      failing.current = true;
    }
  }, [token, handleError]);

  useEffect(() => {
    if (!token) return;
    const first = setTimeout(load, 0);
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [token, load]);

  const markRead = useCallback(
    async (id: string) => {
      const target = notifications.find((item) => item.id === id);
      if (!token || !target || target.is_read) return;
      try {
        await apiClient.patch<Notification>(`/api/notifications/${id}/read`, undefined, { token });
        setNotifications((items) =>
          items.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        handleError(error);
      }
    },
    [token, notifications, handleError],
  );

  return { notifications, unreadCount, markRead };
}
