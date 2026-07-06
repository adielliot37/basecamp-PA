import type { ReactNode } from "react";

export function Panel({
  title,
  count,
  children,
  className = "",
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <header className="flex items-center justify-between gap-3 pb-2 mb-1 border-b border-[var(--color-border)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {title}
        </h2>
        {typeof count === "number" && (
          <span className="text-[11px] font-medium text-[var(--color-text-faint)] tabular-nums">
            {count}
          </span>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-sm text-[var(--color-text-faint)]">{children}</p>
  );
}

export function PanelRow({ children }: { children: ReactNode }) {
  return (
    <div className="py-3 border-b border-[var(--color-border)] last:border-b-0">
      {children}
    </div>
  );
}
