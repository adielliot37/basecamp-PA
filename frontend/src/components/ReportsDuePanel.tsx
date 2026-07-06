"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Panel, EmptyState, PanelRow } from "./Panel";

export function ReportsDuePanel() {
  const { data, error } = usePolling(api.reportsDue, 60_000);

  return (
    <Panel title="Reports due">
      {error && <EmptyState>Couldn&rsquo;t load — {error}</EmptyState>}
      {!error && data === null && <EmptyState>Loading&hellip;</EmptyState>}
      {!error && data && !data.todo_id && (
        <EmptyState>Couldn&rsquo;t find this month&rsquo;s report todo.</EmptyState>
      )}
      {!error && data?.todo_id && (
        <PanelRow>
          <a href={data.app_url ?? undefined} target="_blank" rel="noreferrer" className="group block">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium group-hover:underline">Daily EOS report</p>
              <span
                className={`shrink-0 text-xs font-medium ${
                  data.posted_today ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                }`}
              >
                {data.posted_today ? "Posted today" : "Not posted yet"}
              </span>
            </div>
            {data.last_posted_at && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Last posted {relativeTime(data.last_posted_at)}
              </p>
            )}
          </a>
        </PanelRow>
      )}
    </Panel>
  );
}
