import type { ReactNode } from "react";

import { BaseBadge } from "@/components/shared/BaseBadge";
import type { Priority } from "@/types";

interface AuthShellProps {
  title: string;
  lead: string;
  children: ReactNode;
}

const LANES: { name: string; cards: { title: string; priority: Priority }[] }[] = [
  {
    name: "To do",
    cards: [
      { title: "Draft the onboarding email", priority: "medium" },
      { title: "Book the demo room", priority: "low" },
    ],
  },
  { name: "Doing", cards: [{ title: "Fix the checkout bug", priority: "high" }] },
  { name: "Done", cards: [{ title: "Pick a launch date", priority: "low" }] },
];

/**
 * Frame for the login and register pages: the form, and beside it on wide
 * screens a still picture of what the app is, a board with work moving across it.
 */
export function AuthShell({ title, lead, children }: AuthShellProps) {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 md:grid-cols-[minmax(0,26rem)_1fr] md:py-16">
      <section>
        <p className="font-display text-lg font-semibold text-action">RevoTask</p>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight">
          {title}
        </h1>
        <p className="mt-3 max-w-prose text-ink-soft">{lead}</p>
        <div className="mt-8">{children}</div>
      </section>

      <div aria-hidden="true" className="hidden items-start gap-3 md:flex md:translate-y-2 md:-rotate-2">
        {LANES.map((lane) => (
          <div key={lane.name} className="w-44 shrink-0 rounded-xl bg-lane p-2.5">
            <p className="px-1 pb-2 text-sm font-semibold">{lane.name}</p>
            <div className="flex flex-col gap-2">
              {lane.cards.map((card) => (
                <div key={card.title} className="rounded-md bg-card p-2.5 shadow-sm">
                  <p className="mb-2 text-sm font-medium leading-snug">{card.title}</p>
                  <BaseBadge priority={card.priority} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
