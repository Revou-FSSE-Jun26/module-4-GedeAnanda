"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiClient } from "@/lib/apiClient";
import { clearToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  /** The `revotask_token` cookie as read by the root layout, so the first render already knows it. */
  initialToken: string | null;
  children: ReactNode;
}

/**
 * Holds the signed-in user and their token for Client Components
 * (guideline FE-09). The token comes from the cookie; the user is then loaded
 * from the API once.
 */
export function AuthProvider({ initialToken, children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [user, setUser] = useState<User | null>(null);

  const setAuth = useCallback((nextUser: User, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    if (!token || user) return;
    const controller = new AbortController();
    apiClient
      .get<User>("/api/users/me", { token, signal: controller.signal })
      .then(setUser)
      .catch((error: unknown) => {
        // A rejected token is a dead session. Anything else (offline, aborted) keeps it.
        if (error instanceof ApiError && error.statusCode === 401) {
          clearToken();
          clearAuth();
        }
      });
    return () => controller.abort();
  }, [token, user, clearAuth]);

  const value = useMemo(
    () => ({ user, token, setAuth, clearAuth }),
    [user, token, setAuth, clearAuth],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
