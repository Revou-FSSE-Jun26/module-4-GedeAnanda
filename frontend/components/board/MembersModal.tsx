"use client";

import { useEffect, useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { isValidEmail } from "@/lib/validation";
import type { BoardMember, Deleted, Role } from "@/types";

interface MembersModalProps {
  boardId: string;
  role: Role;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

/** Who is on the board. Admins can add a registered user by email, or remove someone. */
export function MembersModal({ boardId, role }: MembersModalProps) {
  const { token, user } = useAuth();
  const { handleError } = useErrorHandler();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!open || !token) return;
    const controller = new AbortController();
    apiClient
      .get<BoardMember[]>(`/api/boards/${boardId}/members`, { token, signal: controller.signal })
      .then(setMembers)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) handleError(caught);
      });
    return () => controller.abort();
  }, [open, token, boardId, handleError]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const added = await apiClient.post<BoardMember>(
        `/api/boards/${boardId}/members`,
        { email: email.trim(), role: newRole },
        { token },
      );
      setMembers((current) => [...current, added]);
      setEmail("");
      toast.success(`${added.name} added to the board`);
    } catch (caught) {
      // "No user with that email" belongs under the field, not in a generic "Not found" toast.
      if (caught instanceof ApiError && caught.statusCode === 404) setError(caught.message);
      else handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(member: BoardMember) {
    setBusy(true);
    try {
      await apiClient.delete<Deleted>(`/api/boards/${boardId}/members/${member.user_id}`, { token });
      setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
      toast.success(`${member.name} removed from the board`);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BaseButton variant="secondary" onClick={() => setOpen(true)}>
        Members
      </BaseButton>
      <BaseModal open={open} title="Board members" onClose={() => setOpen(false)}>
        <ul className="flex flex-col divide-y divide-line">
          {members.map((member) => (
            <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block font-semibold">{member.name}</span>
                <span className="block break-all text-sm text-ink-soft">
                  {member.email}, {member.role}
                </span>
              </span>
              {isAdmin && member.user_id !== user?.id && (
                <BaseButton
                  variant="destructive"
                  onClick={() => onRemove(member)}
                  disabled={busy}
                  aria-label={`Remove ${member.name}`}
                >
                  Remove
                </BaseButton>
              )}
            </li>
          ))}
        </ul>

        {isAdmin ? (
          <form onSubmit={onAdd} noValidate className="mt-5 flex flex-col gap-4 border-t border-line pt-5">
            <TextField
              id="member-email"
              label="Add someone by email"
              type="email"
              value={email}
              onChange={setEmail}
              error={error}
              hint="They need a RevoTask account first."
            />
            <SelectField
              id="member-role"
              label="Role"
              value={newRole}
              onChange={(value) => setNewRole(value as Role)}
              options={ROLE_OPTIONS}
            />
            <div>
              <BaseButton type="submit" disabled={busy}>
                Add to board
              </BaseButton>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Only a board admin can add or remove people.</p>
        )}
      </BaseModal>
    </>
  );
}
