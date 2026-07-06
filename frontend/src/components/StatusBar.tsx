"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function StatusBar() {
  const { data, error } = usePolling(api.status, 30_000);

  const healthy = !error && data && !data.last_error;
  const dotClass = healthy
    ? "bg-[var(--color-success)]"
    : data === null && !error
    ? "bg-[var(--color-text-faint)]"
    : "bg-[var(--color-danger)]";

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {error && <span>Backend unreachable</span>}
      {!error && data?.last_error && <span title={data.last_error}>Last sync failed</span>}
      {!error && data && !data.last_error && (
        <span>Synced {relativeTime(data.last_ok_at)}</span>
      )}
      {!error && data === null && <span>Connecting&hellip;</span>}
    </div>
  );
}
