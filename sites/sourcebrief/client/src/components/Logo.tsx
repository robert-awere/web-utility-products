type Props = { className?: string; withWordmark?: boolean };

export function Logo({ className = "", withWordmark = true }: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="SourceBrief" data-testid="brand-logo">
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="rlGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#rlGrad)" />
        <circle cx="13" cy="13" r="5.2" stroke="hsl(var(--background))" strokeWidth="2.4" />
        <path d="M17.2 17.2 L23.2 23.2" stroke="hsl(var(--background))" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="13" cy="13" r="1.6" fill="hsl(var(--background))" />
      </svg>
      {withWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Source<span className="text-primary">Brief</span>
        </span>
      )}
    </div>
  );
}
