"use client";

import { useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";
import { BaseModal } from "@/components/shared/BaseModal";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import type { Card, Column, Priority } from "@/types";

interface AddCardFormProps {
  column: Column;
  onCreated: (card: Card) => void;
}

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/** A column's "Add card" button and the form it opens (REQ-27.5). */
export function AddCardForm({ column, onCreated }: AddCardFormProps) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setOpen(false);
    setTitle("");
    setPriority("medium");
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Give the card a title");
      return;
    }
    setSubmitting(true);
    try {
      const card = await apiClient.post<Card>(
        `/api/columns/${column.id}/cards`,
        { title: title.trim(), priority },
        { token },
      );
      onCreated(card);
      close();
    } catch (caught) {
      handleError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <BaseButton
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label={`Add card to ${column.name}`}
        className="w-full border-dashed bg-transparent! text-ink-soft hover:border-action hover:text-action"
      >
        <Icon name="plus" className="h-4 w-4" />
        Add card
      </BaseButton>
      <BaseModal open={open} title={`Add a card to ${column.name}`} onClose={close}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            id={`card-title-${column.id}`}
            label="Card title"
            value={title}
            onChange={setTitle}
            error={error}
            maxLength={200}
            data-autofocus
          />
          <SelectField
            id={`card-priority-${column.id}`}
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as Priority)}
            options={PRIORITY_OPTIONS}
          />
          <div className="flex justify-end gap-2">
            <BaseButton variant="secondary" onClick={close}>
              Cancel
            </BaseButton>
            <BaseButton type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add card"}
            </BaseButton>
          </div>
        </form>
      </BaseModal>
    </>
  );
}
