import { MARKER_BG } from "@/lib/color";
import type { Label } from "@/types";

/** A label as a small chip: its name on its colour. The name is always written, never colour alone. */
export function LabelChip({ label }: { label: Pick<Label, "name" | "color"> }) {
  return (
    <span
      data-color={label.color}
      className={`inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-semibold text-white ${MARKER_BG[label.color]}`}
    >
      <span className="truncate">{label.name}</span>
    </span>
  );
}
