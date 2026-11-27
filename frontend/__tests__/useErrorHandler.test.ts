import { renderHook } from "@testing-library/react";

import {
  GENERIC_ERROR,
  NOT_ALLOWED,
  NOT_FOUND,
  SESSION_EXPIRED,
  useErrorHandler,
} from "@/hooks/useErrorHandler";
import { clearToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { toast } from "@/lib/toast";

const replace = jest.fn();
const clearAuth = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ clearAuth }) }));
jest.mock("@/lib/auth", () => ({ clearToken: jest.fn() }));
jest.mock("@/lib/toast", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

function handle(error: unknown) {
  renderHook(() => useErrorHandler()).result.current.handleError(error);
}

describe("useErrorHandler", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [400, "title: Missing data for required field.", "title: Missing data for required field."],
    [409, "Email is already registered", "Email is already registered"],
    [403, "Only a board admin can do this", NOT_ALLOWED],
    [404, "Board not found", NOT_FOUND],
    [500, "Internal server error", GENERIC_ERROR],
    [503, "database unavailable", GENERIC_ERROR],
    [0, "Could not reach the server", GENERIC_ERROR],
  ])("shows the right message for status %i", (status, apiMessage, shown) => {
    handle(new ApiError(status, apiMessage));

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(shown);
    expect(clearToken).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("on 401 says the session expired, clears the cookie and the context, and goes to /login", () => {
    handle(new ApiError(401, "Token has expired"));

    expect(toast.error).toHaveBeenCalledWith(SESSION_EXPIRED);
    expect(clearToken).toHaveBeenCalledTimes(1);
    expect(clearAuth).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("shows the generic message for something that is not an ApiError", () => {
    handle(new TypeError("boom"));

    expect(toast.error).toHaveBeenCalledWith(GENERIC_ERROR);
    expect(replace).not.toHaveBeenCalled();
  });
});
