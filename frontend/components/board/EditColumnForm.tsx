"use client";

import { useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { Icon } from "@/components/shared/Icon";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import type { Column, Deleted, Role } from "@/types";

interface EditColumnFormProps {
  column: Column;
  /** Every card in the column, also the ones a search or filter hides. */
  cardCount: number;
  role: Role;
  onUpdated: (column: Column) => void;
  onDeleted: (columnId: string) => void;
}

/**
 * The "Edit column" button in a column's header and the form it opens
 * (REQ-39): rename the column, mark it as the place for finished cards, and,
 * for a board admin, delete it after a second confirmation.
 */
export function EditColumnForm({ column, cardCount, role, onUpdated, onDeleted }: EditColumnFormProps) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(column.name);
  const [isDone, setIsDone] = useState(column.is_done);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function show() {
    // Start from the column as it is now; it may have changed since the last time.
    setName(column.name);
    setIsDone(column.is_done);
    setError("");
    setConfirmingDelete(false);
    setOpen(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the column a name");
      return;
    }
    setError("");
    const changes: { name?: string; is_done?: boolean } = {};
    if (name.trim() !== column.name) changes.name = name.trim();
    if (isDone !== column.is_done) changes.is_done = isDone;
    if (Object.keys(changes).length === 0) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      onUpdated(await apiClient.patch<Column>(`/api/columns/${column.id}`, changes, { token }));
      toast.success("Column saved");
      setOpen(false);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await apiClient.delete<Deleted>(`/api/columns/${column.id}`, { token });
      onDeleted(column.id);
      toast.success("Column deleted");
      setOpen(false);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  const cards = cardCount === 1 ? "1 card" : `${cardCount} cards`;

  return (
    <>
      <BaseButton
        variant="secondary"
        onClick={show}
        aria-label={`Edit column ${column.name}`}
        className="-my-2 -mr-1.5 border-transparent! bg-transparent! px-0 text-ink-soft hover:text-ink"
      >
        <Icon name="more" />
      </BaseButton>
      <BaseModal open={open} title="Edit column" onClose={() => setOpen(false)}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            id={`column-name-${column.id}`}
            label="Column name"
            value={name}
            onChange={setName}
            error={error}
            maxLength={100}
            data-autofocus
          />
          <label
            htmlFor={`column-done-${column.id}`}
            className="flex min-h-[44px] items-center gap-3 text-sm"
          >
            <input
              id={`column-done-${column.id}`}
              type="checkbox"
              checked={isDone}
              onChange={(event) => setIsDone(event.target.checked)}
              className="h-5 w-5 accent-[var(--action)]"
            />
            Cards moved here are finished
          </label>
          {isDone !== column.is_done && cardCount > 0 && (
            <p className="rounded-lg bg-board px-3 py-2 text-sm text-ink-soft">
              {isDone
                ? `Saving marks the ${cards} in this column as finished.`
                : `Saving reopens the ${cards} in this column.`}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <BaseButton variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save column"}
            </BaseButton>
          </div>
        </form>

        {role === "admin" && (
          <section aria-label="Delete column" className="mt-6 border-t border-line pt-5">
            {confirmingDelete ? (
              <div className="flex flex-col gap-3">
                <p role="alert" className="text-sm font-medium text-danger">
                  {cardCount === 0
                    ? "Delete this column? This cannot be undone."
                    : `Delete this column and the ${cards} in it? This cannot be undone.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <BaseButton variant="destructive" onClick={onDelete} disabled={busy}>
                    Yes, delete it
                  </BaseButton>
                  <BaseButton variant="secondary" onClick={() => setConfirmingDelete(false)}>
                    Keep the column
                  </BaseButton>
                </div>
              </div>
            ) : (
              <BaseButton variant="destructive" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                Delete column
              </BaseButton>
            )}
          </section>
        )}
      </BaseModal>
    </>
  );
}
