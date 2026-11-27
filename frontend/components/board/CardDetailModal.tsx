"use client";

import { useEffect, useState, type FormEvent } from "react";

import { PRIORITY_OPTIONS } from "@/components/board/AddCardForm";
import { CardChecklist } from "@/components/board/CardChecklist";
import { CardLabels } from "@/components/board/CardLabels";
import { CommentList } from "@/components/board/CommentList";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { SelectField } from "@/components/shared/SelectField";
import { TextAreaField } from "@/components/shared/TextAreaField";
import { TextField } from "@/components/shared/TextField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import type { BoardMember, Card, Column, Comment, Deleted, Label, Priority, Role } from "@/types";

interface CardDetailModalProps {
  card: Card;
  columns: Column[];
  /** Every label of the board. */
  labels: Label[];
  role: Role;
  onClose: () => void;
  onSaved: (card: Card) => void;
  onLabelCreated: (label: Label) => void;
  onDeleted: (cardId: string) => void;
  onMove: (cardId: string, columnId: string) => void;
}

const UNASSIGNED = "";

/**
 * A card's details inside `BaseModal`: editable fields, the "Move to column"
 * select (the way to move a card without a mouse or on a phone), its labels,
 * its checklist and its comments.
 */
export function CardDetailModal({
  card,
  columns,
  labels,
  role,
  onClose,
  onSaved,
  onLabelCreated,
  onDeleted,
  onMove,
}: CardDetailModalProps) {
  const { token, user } = useAuth();
  const { handleError } = useErrorHandler();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [assigneeId, setAssigneeId] = useState(card.assignee?.id ?? UNASSIGNED);
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [titleError, setTitleError] = useState("");
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const options = { token, signal: controller.signal };
    Promise.all([
      apiClient.get<BoardMember[]>(`/api/boards/${card.board_id}/members`, options),
      apiClient.get<Comment[]>(`/api/cards/${card.id}/comments`, options),
    ])
      .then(([loadedMembers, loadedComments]) => {
        setMembers(loadedMembers);
        setComments(loadedComments);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) handleError(error);
      });
    return () => controller.abort();
  }, [token, card.id, card.board_id, handleError]);

  const canDelete = role === "admin" || card.created_by === user?.id;

  /** Only the fields that differ from the card as it was opened. */
  function changes(): Record<string, string | null> {
    const next: Record<string, string | null> = {};
    if (title.trim() !== card.title) next.title = title.trim();
    if (description !== (card.description ?? "")) next.description = description || null;
    if (assigneeId !== (card.assignee?.id ?? UNASSIGNED)) next.assignee_id = assigneeId || null;
    if (dueDate !== (card.due_date ?? "")) next.due_date = dueDate || null;
    if (priority !== card.priority) next.priority = priority;
    return next;
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError("A card needs a title");
      return;
    }
    setTitleError("");
    const body = changes();
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      onSaved(await apiClient.patch<Card>(`/api/cards/${card.id}`, body, { token }));
      toast.success("Card saved");
      onClose();
    } catch (error) {
      handleError(error);
      setSaving(false);
    }
  }

  async function onDelete() {
    setSaving(true);
    try {
      await apiClient.delete<Deleted>(`/api/cards/${card.id}`, { token });
      onDeleted(card.id);
      toast.success("Card deleted");
      onClose();
    } catch (error) {
      handleError(error);
      setSaving(false);
    }
  }

  async function onComment(event: FormEvent) {
    event.preventDefault();
    if (!newComment.trim()) {
      setCommentError("Write something first");
      return;
    }
    setCommentError("");
    setPosting(true);
    try {
      const created = await apiClient.post<Comment>(
        `/api/cards/${card.id}/comments`,
        { content: newComment.trim() },
        { token },
      );
      setComments((current) => [...current, created]);
      setNewComment("");
    } catch (error) {
      handleError(error);
    } finally {
      setPosting(false);
    }
  }

  const assigneeOptions = [
    { value: UNASSIGNED, label: "Nobody" },
    ...members.map((member) => ({ value: member.user_id, label: member.name })),
  ];
  // Until the members arrive, keep the current assignee selectable.
  if (card.assignee && !members.some((member) => member.user_id === card.assignee?.id)) {
    assigneeOptions.push({ value: card.assignee.id, label: card.assignee.name });
  }

  return (
    <BaseModal open title="Card details" onClose={onClose}>
      <form onSubmit={onSave} noValidate className="flex flex-col gap-4">
        <TextField
          id="card-title"
          label="Title"
          value={title}
          onChange={setTitle}
          error={titleError}
          maxLength={200}
        />
        <TextAreaField
          id="card-description"
          label="Description"
          value={description}
          onChange={setDescription}
          maxLength={5000}
          rows={4}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="card-assignee"
            label="Assigned to"
            value={assigneeId}
            onChange={setAssigneeId}
            options={assigneeOptions}
          />
          <SelectField
            id="card-priority"
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as Priority)}
            options={PRIORITY_OPTIONS}
          />
          <TextField id="card-due-date" label="Due date" type="date" value={dueDate} onChange={setDueDate} />
          <SelectField
            id="card-column"
            label="Move to column"
            value={card.column_id}
            onChange={(columnId) => onMove(card.id, columnId)}
            options={columns.map((column) => ({ value: column.id, label: column.name }))}
          />
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          {canDelete ? (
            <BaseButton variant="destructive" onClick={onDelete} disabled={saving}>
              Delete card
            </BaseButton>
          ) : (
            <span />
          )}
          <BaseButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </BaseButton>
        </div>
      </form>

      <CardLabels card={card} labels={labels} onSaved={onSaved} onLabelCreated={onLabelCreated} />
      <CardChecklist card={card} onSaved={onSaved} />

      <section aria-labelledby="comments-heading" className="mt-6 border-t border-line pt-5">
        <h3 id="comments-heading" className="mb-3 font-display text-lg font-semibold">
          Comments
        </h3>
        <CommentList
          comments={comments}
          onUpdated={(updated) =>
            setComments((current) => current.map((item) => (item.id === updated.id ? updated : item)))
          }
          onDeleted={(id) => setComments((current) => current.filter((item) => item.id !== id))}
        />
        <form onSubmit={onComment} noValidate className="mt-4 flex flex-col gap-2">
          <TextAreaField
            id="new-comment"
            label="Add a comment"
            value={newComment}
            onChange={setNewComment}
            error={commentError}
            maxLength={2000}
          />
          <div>
            <BaseButton type="submit" variant="secondary" disabled={posting}>
              {posting ? "Posting…" : "Post comment"}
            </BaseButton>
          </div>
        </form>
      </section>
    </BaseModal>
  );
}
