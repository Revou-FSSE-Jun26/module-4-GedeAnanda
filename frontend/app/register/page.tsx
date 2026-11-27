"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { BaseButton } from "@/components/shared/BaseButton";
import { TextField } from "@/components/shared/TextField";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "@/lib/validation";
import type { User } from "@/types";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Enter your name";
  if (!isValidEmail(email)) errors.email = "Enter a valid email address";
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const { handleError } = useErrorHandler();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const found = validate(name, email, password);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await apiClient.post<User>("/api/auth/register", { name: name.trim(), email: email.trim(), password });
      toast.success("Account created. Log in to continue.");
      router.push("/login");
    } catch (error) {
      // REQ-25.7: the API's message is shown on the page.
      if (error instanceof ApiError && error.statusCode !== 0) setFormError(error.message);
      else handleError(error);
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create your account" lead="One account for every board you are invited to.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-high-wash px-3 py-2.5 text-sm font-medium text-high">
            {formError}
          </p>
        )}
        <TextField
          id="name"
          label="Name"
          autoComplete="name"
          value={name}
          onChange={setName}
          error={errors.name}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
        <BaseButton type="submit" disabled={submitting} className="mt-2">
          {submitting ? "Creating account…" : "Create account"}
        </BaseButton>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-action underline underline-offset-4">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
