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
    <section
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg ${className}`}
    >
      <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {typeof count === "number" && (
          <span className="text-xs font-medium text-[var(--color-text-muted)] tabular-nums">
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
    <p className="px-5 py-8 text-center text-sm text-[var(--color-text-faint)]">{children}</p>
  );
}

export function PanelRow({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-3 border-b border-[var(--color-border)] last:border-b-0">
      {children}
    </div>
  );
}
