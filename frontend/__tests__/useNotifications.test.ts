import { act, renderHook, waitFor } from "@testing-library/react";

import { POLL_INTERVAL_MS, useNotifications } from "@/hooks/useNotifications";
import { apiClient } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import type { Notification, NotificationPage } from "@/types";

const handleError = jest.fn();
let token: string | null = "jwt";

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { get: jest.fn(), patch: jest.fn() } }));

const get = apiClient.get as jest.Mock;
const patch = apiClient.patch as jest.Mock;

function notification(id: string, is_read = false): Notification {
  return {
    id,
    type: "board_invite",
    message: `Message ${id}`,
    is_read,
    card_id: null,
    board_id: null,
    created_at: "2026-11-27T08:00:00+00:00",
  };
}

function page(items: Notification[], unread_count: number): NotificationPage {
  return { items, page: 1, per_page: 20, total: items.length, unread_count };
}

/** Let the timers that are due run, and the promises they started settle. */
async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe("useNotifications", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    token = "jwt";
    get.mockResolvedValue(page([notification("a"), notification("b", true)], 1));
    patch.mockResolvedValue(notification("a", true));
  });

  afterEach(() => jest.useRealTimers());

  it("loads at once, with the token, and exposes the list and the unread count", async () => {
    const { result } = renderHook(() => useNotifications());
    await advance(0);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/api/notifications", { token: "jwt" });
    expect(result.current.notifications.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.current.unreadCount).toBe(1);
  });

  it("polls again every 30 seconds and picks up a new unread count", async () => {
    const { result } = renderHook(() => useNotifications());
    await advance(0);
    get.mockResolvedValue(page([notification("c"), notification("a"), notification("b", true)], 2));

    await advance(POLL_INTERVAL_MS - 1);
    expect(get).toHaveBeenCalledTimes(1);

    await advance(1);
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.current.unreadCount).toBe(2);

    await advance(POLL_INTERVAL_MS * 2);
    expect(get).toHaveBeenCalledTimes(4);
  });

  it("stops polling when the component unmounts", async () => {
    const { unmount } = renderHook(() => useNotifications());
    await advance(0);

    unmount();
    await advance(POLL_INTERVAL_MS * 3);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("does not call the API without a token", async () => {
    token = null;

    renderHook(() => useNotifications());
    await advance(POLL_INTERVAL_MS * 2);

    expect(get).not.toHaveBeenCalled();
  });

  it("markRead calls the API, marks the item and lowers the count by one", async () => {
    const { result } = renderHook(() => useNotifications());
    await advance(0);

    await act(() => result.current.markRead("a"));

    expect(patch).toHaveBeenCalledWith("/api/notifications/a/read", undefined, { token: "jwt" });
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(result.current.notifications[0].is_read).toBe(true);
  });

  it("markRead does nothing for a notification that is already read", async () => {
    const { result } = renderHook(() => useNotifications());
    await advance(0);

    await act(() => result.current.markRead("b"));

    expect(patch).not.toHaveBeenCalled();
    expect(result.current.unreadCount).toBe(1);
  });

  it("a failed markRead is reported and leaves the count alone", async () => {
    const error = new ApiError(404, "Notification not found");
    patch.mockRejectedValue(error);
    const { result } = renderHook(() => useNotifications());
    await advance(0);

    await act(() => result.current.markRead("a"));

    expect(handleError).toHaveBeenCalledWith(error);
    expect(result.current.unreadCount).toBe(1);
  });

  it("reports a failing poll once, not on every tick, and again after a recovery", async () => {
    const error = new ApiError(0, "Could not reach the server");
    get.mockRejectedValue(error);
    renderHook(() => useNotifications());
    await advance(0);
    await advance(POLL_INTERVAL_MS * 2);
    expect(handleError).toHaveBeenCalledTimes(1);

    get.mockResolvedValue(page([], 0));
    await advance(POLL_INTERVAL_MS);
    get.mockRejectedValue(error);
    await advance(POLL_INTERVAL_MS);

    expect(handleError).toHaveBeenCalledTimes(2);
  });
});
