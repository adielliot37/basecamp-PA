"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  tone?: "muted" | "danger" | "warning" | "success";
}) {
  const toneClass = {
    muted: "text-[var(--color-text)]",
    danger: "text-[var(--color-danger)]",
    warning: "text-[var(--color-warning)]",
    success: "text-[var(--color-success)]",
  }[tone];

  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</span>
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
    </div>
  );
}

export function StatusStrip() {
  const { data: needsReply } = usePolling(api.needsReply, 25_000);
  const { data: tasks } = usePolling(api.tasks, 45_000);
  const { data: reportsDue } = usePolling(api.reportsDue, 60_000);

  const overdueCount =
    tasks?.filter((t) => t.due_on && new Date(t.due_on + "T00:00:00") < new Date(new Date().toDateString())).length ??
    0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
      <Stat
        label="need your reply"
        value={needsReply?.length ?? "–"}
        tone={needsReply && needsReply.length > 0 ? "danger" : "success"}
      />
      <Stat
        label="overdue"
        value={overdueCount}
        tone={overdueCount > 0 ? "danger" : "success"}
      />
      {reportsDue?.posted_today ? (
        <Stat label="EOS report" value="posted" tone="success" />
      ) : (
        <a
          href={reportsDue?.app_url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          <Stat label="EOS report" value="pending" tone="warning" />
        </a>
      )}
    </div>
  );
}
