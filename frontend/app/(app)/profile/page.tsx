"use client";

import { useState, type FormEvent } from "react";

import { Avatar } from "@/components/shared/Avatar";
import { BaseButton } from "@/components/shared/BaseButton";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { isValidEmail } from "@/lib/validation";
import type { User } from "@/types";

interface FieldErrors {
  name?: string;
  email?: string;
}

function ProfileForm({ user, token }: { user: User; token: string }) {
  const { setAuth } = useAuth();
  const { handleError } = useErrorHandler();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!name.trim()) found.name = "Enter your name";
    if (!isValidEmail(email)) found.email = "Enter a valid email address";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const updated = await apiClient.patch<User>(
        "/api/users/me",
        { name: name.trim(), email: email.trim() },
        { token },
      );
      setAuth(updated, token);
      toast.success("Profile saved");
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <TextField id="profile-name" label="Name" autoComplete="name" value={name} onChange={setName} error={errors.name} maxLength={100} />
      <TextField id="profile-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.email} />
      <div>
        <BaseButton type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </BaseButton>
      </div>
    </form>
  );
}

/** Profile: name and email, pre-filled from AuthContext (REQ-14.4). */
export default function ProfilePage() {
  const { user, token } = useAuth();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="max-w-md">
        <div className="flex items-center gap-4">
          {user && <Avatar id={user.id} name={user.name} size="lg" decorative />}
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Profile</h1>
        </div>
        {user && token ? (
          // Keyed by user so the inputs start from the loaded values.
          <ProfileForm key={user.id} user={user} token={token} />
        ) : (
          <p className="mt-6 text-ink-soft">Loading your profile…</p>
        )}
      </div>
    </main>
  );
}
