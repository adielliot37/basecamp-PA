"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Panel, EmptyState, PanelRow } from "./Panel";

export function WaitingOnPanel() {
  const { data, error } = usePolling(api.waitingOn, 45_000);

  if (!error && data?.length === 0) return null;

  return (
    <Panel title="Waiting on a reply" count={data?.length}>
      {error && <EmptyState>Couldn&rsquo;t load — {error}</EmptyState>}
      {!error && data === null && <EmptyState>Loading&hellip;</EmptyState>}
      {data?.map((item) => (
        <PanelRow key={item.recording_id}>
          <a
            href={item.app_url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate group-hover:underline">{item.title}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {item.project_name} &middot; you followed up {relativeTime(item.last_activity_at)}
              </p>
            </div>
            <span className="shrink-0 text-xs text-[var(--color-text-faint)] mt-0.5">Open &rarr;</span>
          </a>
        </PanelRow>
      ))}
    </Panel>
  );
}
