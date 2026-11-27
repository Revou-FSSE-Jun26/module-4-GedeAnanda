"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { BaseButton } from "@/components/shared/BaseButton";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { setToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import type { LoginResult } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const { handleError } = useErrorHandler();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const result = await apiClient.post<LoginResult>("/api/auth/login", { email, password });
      setToken(result.access_token);
      setAuth(result.user, result.access_token);
      router.replace("/");
      router.refresh();
    } catch (error) {
      // REQ-3.6: a rejected login is shown on the page, in the API's own words.
      // It must not go through handleError, where a 401 means "session expired".
      if (error instanceof ApiError && error.statusCode !== 0) setFormError(error.message);
      else handleError(error);
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Log in" lead="Pick up your boards where you left them.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-high-wash px-3 py-2.5 text-sm font-medium text-high">
            {formError}
          </p>
        )}
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
        />
        <BaseButton type="submit" disabled={submitting} className="mt-2">
          {submitting ? "Logging in…" : "Log in"}
        </BaseButton>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/register" className="font-semibold text-action underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
