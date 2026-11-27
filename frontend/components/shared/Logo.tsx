/** The RevoTask mark: three columns of a board, the middle one with a card on its way up. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl font-semibold text-ink ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 28 28" className="h-7 w-7 shrink-0">
        <rect width="28" height="28" rx="8" className="fill-action" />
        <rect x="5.5" y="6.5" width="4.5" height="15" rx="1.6" className="fill-on-action" opacity="0.55" />
        <rect x="11.75" y="6.5" width="4.5" height="9" rx="1.6" className="fill-on-action" />
        <rect x="18" y="6.5" width="4.5" height="12" rx="1.6" className="fill-on-action" opacity="0.55" />
      </svg>
      RevoTask
    </span>
  );
}
