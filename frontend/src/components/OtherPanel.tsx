"use client";

import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Panel, EmptyState, PanelRow } from "./Panel";

export function OtherPanel() {
  const { data, error } = usePolling(api.other, 45_000);
  const [showAll, setShowAll] = useState(false);

  return (
    <Panel title="Everything else" count={data?.total}>
      {error && <EmptyState>Couldn&rsquo;t load — {error}</EmptyState>}
      {!error && data === null && <EmptyState>Loading&hellip;</EmptyState>}
      {!error && data?.total === 0 && <EmptyState>Inbox zero.</EmptyState>}

      {data && data.total > 0 && !showAll && (
        <>
          {data.highlights.length === 0 && (
            <PanelRow>
              <p className="text-sm text-[var(--color-text-muted)]">
                Nothing stands out &mdash; all routine.
              </p>
            </PanelRow>
          )}
          {data.highlights.map((h) => (
            <PanelRow key={h.id}>
              <a
                href={h.app_url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:underline">{h.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{h.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--color-text-faint)] mt-0.5">
                  {relativeTime(h.created_at_bc)}
                </span>
              </a>
            </PanelRow>
          ))}
          {data.routineSummary && (
            <PanelRow>
              <p className="text-xs text-[var(--color-text-faint)]">{data.routineSummary}</p>
            </PanelRow>
          )}
          <PanelRow>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-medium text-[var(--color-accent)]"
            >
              Show all {data.total} &rarr;
            </button>
          </PanelRow>
        </>
      )}

      {data && showAll && (
        <>
          {data.all.map((n) => (
            <PanelRow key={n.id}>
              <a
                href={n.app_url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate group-hover:underline">{n.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {n.project_name} &middot; {n.type}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--color-text-faint)] mt-0.5">
                  {relativeTime(n.created_at_bc)}
                </span>
              </a>
            </PanelRow>
          ))}
          <PanelRow>
            <button
              onClick={() => setShowAll(false)}
              className="text-xs font-medium text-[var(--color-accent)]"
            >
              Show summary &rarr;
            </button>
          </PanelRow>
        </>
      )}
    </Panel>
  );
}
