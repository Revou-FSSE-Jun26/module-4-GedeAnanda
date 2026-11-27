"use client";

import { PRIORITY_OPTIONS } from "@/components/board/AddCardForm";
import { BaseButton } from "@/components/shared/BaseButton";
import { SelectField } from "@/components/shared/SelectField";
import { ANY, NONE, NO_FILTERS, activeFilterCount, type CardFilters, type DueFilter } from "@/lib/filters";
import type { Label, PersonRef } from "@/types";

interface BoardFiltersProps {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
  people: PersonRef[];
  labels: Label[];
}

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: ANY, label: "Any date" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due in the next 7 days" },
  { value: NONE, label: "No due date" },
];

/** The four board filters (REQ-36.1). Changing one changes the board at once; no request is sent. */
export function BoardFilters({ filters, onChange, people, labels }: BoardFiltersProps) {
  const set = (change: Partial<CardFilters>) => onChange({ ...filters, ...change });

  return (
    <div
      id="board-filters"
      role="group"
      aria-label="Filters"
      className="grid w-full animate-rise gap-3 rounded-2xl border border-line bg-card p-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
    >
      <SelectField
        id="filter-assignee"
        label="Assigned to"
        value={filters.assignee}
        onChange={(assignee) => set({ assignee })}
        options={[
          { value: ANY, label: "Anyone" },
          { value: NONE, label: "Nobody" },
          ...people.map((person) => ({ value: person.id, label: person.name })),
        ]}
      />
      <SelectField
        id="filter-priority"
        label="Priority"
        value={filters.priority}
        onChange={(priority) => set({ priority: priority as CardFilters["priority"] })}
        options={[{ value: ANY, label: "Any priority" }, ...PRIORITY_OPTIONS]}
      />
      <SelectField
        id="filter-label"
        label="Label"
        value={filters.label}
        onChange={(label) => set({ label })}
        options={[
          { value: ANY, label: "Any label" },
          ...labels.map((label) => ({ value: label.id, label: label.name })),
        ]}
      />
      <SelectField
        id="filter-due"
        label="Due date"
        value={filters.due}
        onChange={(due) => set({ due: due as DueFilter })}
        options={DUE_OPTIONS}
      />
      <BaseButton
        variant="secondary"
        onClick={() => onChange(NO_FILTERS)}
        disabled={activeFilterCount(filters) === 0}
      >
        Clear filters
      </BaseButton>
    </div>
  );
}
