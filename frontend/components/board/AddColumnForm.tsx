"use client";

import { useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import type { Column } from "@/types";

interface AddColumnFormProps {
  boardId: string;
  onCreated: (column: Column) => void;
}

/** The "Add column" button and the form it opens (REQ-27.4). */
export function AddColumnForm({ boardId, onCreated }: AddColumnFormProps) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setOpen(false);
    setName("");
    setIsDone(false);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the column a name");
      return;
    }
    setSubmitting(true);
    try {
      const column = await apiClient.post<Column>(
        `/api/boards/${boardId}/columns`,
        { name: name.trim(), is_done: isDone },
        { token },
      );
      onCreated(column);
      close();
    } catch (caught) {
      handleError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <BaseButton variant="secondary" onClick={() => setOpen(true)}>
        Add column
      </BaseButton>
      <BaseModal open={open} title="Add a column" onClose={close}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            id="column-name"
            label="Column name"
            value={name}
            onChange={setName}
            error={error}
            maxLength={100}
            data-autofocus
          />
          <label htmlFor="column-is-done" className="flex min-h-[44px] items-center gap-3 text-sm">
            <input
              id="column-is-done"
              type="checkbox"
              checked={isDone}
              onChange={(event) => setIsDone(event.target.checked)}
              className="h-5 w-5 accent-action"
            />
            Cards moved here are finished
          </label>
          <div className="flex justify-end gap-2">
            <BaseButton variant="secondary" onClick={close}>
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add column"}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </>
  );
}
