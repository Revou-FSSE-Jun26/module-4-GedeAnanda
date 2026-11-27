"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import type { Board } from "@/types";

/** The dashboard's "New board" button and the form it opens. */
export function CreateBoardModal() {
  const router = useRouter();
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setOpen(false);
    setName("");
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the board a name");
      return;
    }
    setSubmitting(true);
    try {
      const board = await apiClient.post<Board>("/api/boards", { name: name.trim() }, { token });
      toast.success(`Board "${board.name}" created`);
      close();
      router.refresh(); // the dashboard is a Server Component: ask it for the new list
    } catch (caught) {
      handleError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <BaseButton onClick={() => setOpen(true)}>New board</BaseButton>
      <BaseModal open={open} title="Create a board" onClose={close}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            id="board-name"
            label="Board name"
            value={name}
            onChange={setName}
            error={error}
            maxLength={100}
            data-autofocus
          />
          <div className="flex justify-end gap-2">
            <BaseButton variant="secondary" onClick={close}>
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create board"}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </>
  );
}
