"use client";

import { useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";
import { SelectField } from "@/components/shared/SelectField";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { MARKERS, MARKER_BG, MARKER_NAMES } from "@/lib/color";
import { ApiError } from "@/lib/errors";
import type { Card, Label, LabelColor } from "@/types";

interface CardLabelsProps {
  card: Card;
  /** Every label of the board. */
  labels: Label[];
  onSaved: (card: Card) => void;
  onLabelCreated: (label: Label) => void;
}

const COLOR_OPTIONS = MARKERS.map((color) => ({ value: color, label: MARKER_NAMES[color] }));

/**
 * The labels part of the card modal (REQ-34.14): every label of the board as a
 * button that turns it on or off for this card, and a small form for a new label.
 */
export function CardLabels({ card, labels, onSaved, onLabelCreated }: CardLabelsProps) {
  const { token } = useAuth();
  const { handleError } = useErrorHandler();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("cobalt");
  const [error, setError] = useState("");

  const onCard = new Set(card.labels.map((label) => label.id));

  async function setLabels(labelIds: string[]) {
    setBusy(true);
    try {
      onSaved(await apiClient.patch<Card>(`/api/cards/${card.id}`, { label_ids: labelIds }, { token }));
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  function toggle(label: Label) {
    const next = onCard.has(label.id)
      ? [...onCard].filter((id) => id !== label.id)
      : [...onCard, label.id];
    void setLabels(next);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation(); // this form sits inside the modal, not inside the card form
    if (!name.trim()) {
      setError("Give the label a name");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const created = await apiClient.post<Label>(
        `/api/boards/${card.board_id}/labels`,
        { name: name.trim(), color },
        { token },
      );
      onLabelCreated(created);
      setName("");
      setAdding(false);
      // A label made from a card is meant for that card.
      await setLabels([...onCard, created.id]);
    } catch (caught) {
      // "Already has a label with that name" belongs under the field.
      if (caught instanceof ApiError && caught.statusCode === 409) setError(caught.message);
      else handleError(caught);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="labels-heading" className="mt-6 border-t border-line pt-5">
      <h3 id="labels-heading" className="mb-3 font-display text-lg font-semibold">
        Labels
      </h3>
      {labels.length === 0 && !adding && (
        <p className="mb-3 text-sm text-ink-soft">
          This board has no labels yet. Make one, for example “Bug” or “Design”.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => {
          const selected = onCard.has(label.id);
          return (
            <BaseButton
              key={label.id}
              variant="secondary"
              aria-pressed={selected}
              onClick={() => toggle(label)}
              disabled={busy}
              className={selected ? "border-action! bg-action-wash!" : ""}
            >
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${MARKER_BG[label.color]}`} />
              {label.name}
              {selected && <Icon name="check" className="h-4 w-4 text-action" />}
            </BaseButton>
          );
        })}
        {!adding && (
          <BaseButton variant="secondary" onClick={() => setAdding(true)} className="border-dashed text-ink-soft">
            <Icon name="plus" className="h-4 w-4" />
            New label
          </BaseButton>
        )}
      </div>

      {adding && (
        <form onSubmit={onCreate} noValidate className="mt-3 grid gap-3 rounded-xl bg-board p-3 sm:grid-cols-2">
          <TextField
            id="label-name"
            label="Label name"
            value={name}
            onChange={setName}
            error={error}
            maxLength={40}
            data-autofocus
          />
          <SelectField
            id="label-color"
            label="Colour"
            value={color}
            onChange={(value) => setColor(value as LabelColor)}
            options={COLOR_OPTIONS}
          />
          <div className="flex gap-2 sm:col-span-2">
            <BaseButton type="submit" disabled={busy}>
              Create label
            </BaseButton>
            <BaseButton
              variant="secondary"
              onClick={() => {
                setAdding(false);
                setError("");
              }}
            >
              Cancel
            </BaseButton>
          </div>
        </form>
      )}
    </section>
  );
}
