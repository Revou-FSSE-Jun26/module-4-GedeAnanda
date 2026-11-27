import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  children: ReactNode;
  /** The control that adds the first item, when there is one. */
  action?: ReactNode;
}

/**
 * What a list shows when it has nothing in it (REQ-33.8): what is missing and
 * how to add the first one, beside a board that is still blank.
 */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-line px-5 py-12 text-center">
      <svg aria-hidden="true" viewBox="0 0 120 72" className="mb-5 h-[4.5rem] w-[7.5rem]" fill="none">
        <rect x="1" y="1" width="34" height="70" rx="6" className="fill-lane" />
        <rect x="43" y="1" width="34" height="46" rx="6" className="fill-lane" />
        <rect x="85" y="1" width="34" height="58" rx="6" className="fill-lane" />
        <rect x="6" y="8" width="24" height="14" rx="3" className="fill-card stroke-line" strokeDasharray="3 3" />
        <rect x="48" y="8" width="24" height="14" rx="3" className="fill-card stroke-line" strokeDasharray="3 3" />
        <rect x="90" y="8" width="24" height="14" rx="3" className="fill-card stroke-line" strokeDasharray="3 3" />
      </svg>
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-2 max-w-sm text-ink-soft">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
