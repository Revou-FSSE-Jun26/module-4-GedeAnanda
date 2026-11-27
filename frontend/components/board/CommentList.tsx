"use client";

import { useState, type FormEvent } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { Avatar } from "@/components/shared/Avatar";
import { TextAreaField } from "@/components/shared/TextAreaField";
import { useAuth } from "@/context/AuthContext";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { apiClient } from "@/lib/apiClient";
import { formatDate, wasEdited } from "@/lib/format";
import type { Comment, Deleted } from "@/types";

interface CommentListProps {
  comments: Comment[];
  onUpdated: (comment: Comment) => void;
  onDeleted: (commentId: string) => void;
}

/**
 * A card's comments, oldest first. Edit and Delete are shown only on the
 * current user's own comments (REQ-28.6, 28.7).
 */
export function CommentList({ comments, onUpdated, onDeleted }: CommentListProps) {
  const { token, user } = useAuth();
  const { handleError } = useErrorHandler();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function startEditing(comment: Comment) {
    setEditingId(comment.id);
    setDraft(comment.content);
    setError("");
  }

  async function save(event: FormEvent, comment: Comment) {
    event.preventDefault();
    if (!draft.trim()) {
      setError("A comment cannot be empty");
      return;
    }
    setBusy(true);
    try {
      const updated = await apiClient.patch<Comment>(
        `/api/comments/${comment.id}`,
        { content: draft.trim() },
        { token },
      );
      onUpdated(updated);
      setEditingId(null);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function remove(comment: Comment) {
    setBusy(true);
    try {
      await apiClient.delete<Deleted>(`/api/comments/${comment.id}`, { token });
      onDeleted(comment.id);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (comments.length === 0) {
    return <p className="text-sm text-ink-soft">No comments yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {comments.map((comment) => {
        const mine = user?.id === comment.author.id;
        const edited = wasEdited(comment.created_at, comment.updated_at);
        return (
          <li key={comment.id} className="rounded-xl bg-board p-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Avatar id={comment.author.id} name={comment.author.name} size="sm" decorative />
              <span className="font-semibold">{comment.author.name}</span>
              <span className="text-ink-soft">
                on {formatDate(comment.created_at)}
                {edited && ", edited"}
              </span>
            </p>
            {editingId === comment.id ? (
              <form onSubmit={(event) => save(event, comment)} noValidate className="mt-2 flex flex-col gap-2">
                <TextAreaField
                  id={`comment-edit-${comment.id}`}
                  label="Edit your comment"
                  labelHidden
                  value={draft}
                  onChange={setDraft}
                  error={error}
                  maxLength={2000}
                />
                <div className="flex gap-2">
                  <BaseButton type="submit" disabled={busy}>
                    Save comment
                  </BaseButton>
                  <BaseButton variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </BaseButton>
                </div>
              </form>
            ) : (
              <>
                <p className="mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                {mine && (
                  <div className="mt-2 flex gap-2">
                    <BaseButton variant="secondary" onClick={() => startEditing(comment)} disabled={busy}>
                      Edit
                    </BaseButton>
                    <BaseButton variant="destructive" onClick={() => remove(comment)} disabled={busy}>
                      Delete
                    </BaseButton>
                  </div>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
