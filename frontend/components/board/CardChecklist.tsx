"use client";

import { useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import type { Card, ChecklistItem, Deleted } from "@/types";

interface CardChecklistProps {
  card: Card;
  onSaved: (card: Card) => void;
}

/**
 * The checklist part of the card modal (REQ-35.8): a progress bar, a checkbox
 * per step, and controls to add and delete steps. Every change is saved at once.
 * The parent owns the card, so each change is handed up through `onSaved`.
 */
export function CardChecklist({ card, onSaved }: CardChecklistProps) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const items = card.checklist;
  const done = items.filter((item) => item.is_done).length;

  /** Run one request, then put the new checklist on the card. */
  async function change(request: () => Promise<ChecklistItem[]>) {
    setBusy(true);
    try {
      onSaved({ ...card, checklist: await request() });
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Ticking is optimistic (guideline FE-07): the box changes at once, the
   * request follows, and a refused request puts the checklist back as it was.
   */
  async function onToggle(item: ChecklistItem) {
    const snapshot = card;
    const isDone = !item.is_done;
    onSaved({
      ...card,
      checklist: items.map((other) => (other.id === item.id ? { ...other, is_done: isDone } : other)),
    });
    try {
      await apiClient.patch<ChecklistItem>(`/api/checklist-items/${item.id}`, { is_done: isDone }, { token });
    } catch (caught) {
      onSaved(snapshot);
      handleError(caught);
    }
  }

  function onDelete(item: ChecklistItem) {
    void change(async () => {
      await apiClient.delete<Deleted>(`/api/checklist-items/${item.id}`, { token });
      return items.filter((other) => other.id !== item.id);
    });
  }

  function onAdd(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!text.trim()) {
      setError("Write the step first");
      return;
    }
    setError("");
    void change(async () => {
      const created = await apiClient.post<ChecklistItem>(
        `/api/cards/${card.id}/checklist`,
        { text: text.trim() },
        { token },
      );
      setText("");
      return [...items, { id: created.id, text: created.text, is_done: created.is_done }];
    });
  }

  return (
    <section aria-labelledby="checklist-heading" className="mt-6 border-t border-line pt-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 id="checklist-heading" className="font-display text-lg font-semibold">
          Checklist
        </h3>
        {items.length > 0 && (
          <span className="text-sm tabular-nums text-ink-soft">
            {done} of {items.length} done
          </span>
        )}
      </div>

      {items.length > 0 && (
        <progress
          value={done}
          max={items.length}
          aria-label={`Checklist: ${done} of ${items.length} done`}
          className={
            "mb-3 h-2 w-full appearance-none overflow-hidden rounded-full bg-board " +
            "[&::-webkit-progress-bar]:bg-board " +
            (done === items.length
              ? "[&::-moz-progress-bar]:bg-low [&::-webkit-progress-value]:bg-low"
              : "[&::-moz-progress-bar]:bg-action [&::-webkit-progress-value]:bg-action")
          }
        />
      )}

      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-1">
            <label
              htmlFor={`check-${item.id}`}
              className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-board"
            >
              <input
                id={`check-${item.id}`}
                type="checkbox"
                checked={item.is_done}
                onChange={() => void onToggle(item)}
                disabled={busy}
                className="h-5 w-5 shrink-0 accent-[var(--action)]"
              />
              <span className={`min-w-0 break-words ${item.is_done ? "text-ink-soft line-through" : ""}`}>
                {item.text}
              </span>
            </label>
            <BaseButton
              variant="secondary"
              onClick={() => onDelete(item)}
              disabled={busy}
              aria-label={`Delete step: ${item.text}`}
              className="border-transparent! px-0 text-ink-soft"
            >
              <Icon name="close" className="h-4 w-4" />
            </BaseButton>
          </li>
        ))}
      </ul>

      <form onSubmit={onAdd} noValidate className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-48">
          <TextField
            id="checklist-new"
            label="Add a step"
            value={text}
            onChange={setText}
            error={error}
            maxLength={300}
          />
        </div>
        <BaseButton type="submit" variant="secondary" disabled={busy} className={error ? "mb-7" : ""}>
          Add step
        </BaseButton>
      </form>
    </section>
  );
}
