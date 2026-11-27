"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { BaseButton } from "@/components/shared/BaseButton";
import { Icon } from "@/components/shared/Icon";

interface BaseModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The app's only modal (guideline FE-04). Closes on Escape or a click on the
 * backdrop, keeps Tab inside the dialog while it is open, and gives focus
 * back to whatever opened it.
 */
export function BaseModal({ open, title, onClose, children }: BaseModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? dialog;
    first?.focus();
    return () => trigger?.focus();
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-[rgb(var(--shade)/0.55)] p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="max-h-[92dvh] w-full animate-rise overflow-y-auto rounded-t-3xl bg-card p-5 shadow-lift outline-none sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-semibold leading-tight">
            {title}
          </h2>
          <BaseButton variant="secondary" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 px-0">
            <Icon name="close" />
          </BaseButton>
        </div>
        {children}
      </div>
    </div>
  );
}
