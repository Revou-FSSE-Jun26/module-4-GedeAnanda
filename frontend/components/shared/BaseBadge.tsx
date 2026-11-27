import type { Priority } from "@/types";

interface BaseBadgeProps {
  priority: Priority;
}

const PRIORITY_CLASSES: Record<Priority, string> = {
  low: "bg-low-wash text-low",
  medium: "bg-medium-wash text-medium",
  high: "bg-high-wash text-high",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Priority label. The word is always shown, so the meaning never depends on
 * colour alone.
 */
export function BaseBadge({ priority }: BaseBadgeProps) {
  return (
    <span
      data-priority={priority}
      className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2 pr-2.5 text-xs font-semibold ${PRIORITY_CLASSES[priority]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
