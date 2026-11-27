"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useAuth } from "@/context/AuthContext";
import { clearToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { toast } from "@/lib/toast";

export const SESSION_EXPIRED = "Session expired. Log in again.";
export const NOT_ALLOWED = "Not allowed";
export const NOT_FOUND = "Not found";
export const GENERIC_ERROR = "Something went wrong, please try again";

/**
 * The one place that turns a failed API call into something the user sees
 * (guideline FE-03). A 401 always ends the session, wherever it happens.
 */
export function useErrorHandler() {
  const router = useRouter();
  const { clearAuth } = useAuth();

  const handleError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) {
        toast.error(GENERIC_ERROR);
        return;
      }
      switch (error.statusCode) {
        case 400:
        case 409:
          toast.error(error.message);
          break;
        case 401:
          toast.error(SESSION_EXPIRED);
          clearToken();
          clearAuth();
          router.replace("/login");
          break;
        case 403:
          toast.error(NOT_ALLOWED);
          break;
        case 404:
          toast.error(NOT_FOUND);
          break;
        default:
          toast.error(GENERIC_ERROR);
      }
    },
    [router, clearAuth],
  );

  return { handleError };
}
