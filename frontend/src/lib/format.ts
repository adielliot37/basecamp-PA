export function relativeTime(ms: number | null): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "just now";
  if (abs < hour) return `${Math.round(abs / minute)}m ago`;
  if (abs < day) return `${Math.round(abs / hour)}h ago`;
  return `${Math.round(abs / day)}d ago`;
}

export function dueLabel(dueOn: string | null): { label: string; tone: "danger" | "warning" | "muted" } {
  if (!dueOn) return { label: "No due date", tone: "muted" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueOn + "T00:00:00");
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, tone: "danger" };
  if (diffDays === 0) return { label: "Due today", tone: "warning" };
  if (diffDays === 1) return { label: "Due tomorrow", tone: "warning" };
  return { label: `Due ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, tone: "muted" };
}
