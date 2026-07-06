"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Panel, EmptyState, PanelRow } from "./Panel";

function KindBadge({ kind }: { kind: "mention" | "chat" }) {
  return (
    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)]">
      {kind === "chat" ? "Ping" : "Mention"}
    </span>
  );
}

export function NeedsReplyPanel() {
  const { data, error } = usePolling(api.needsReply, 25_000);

  return (
    <Panel title="Needs your attention" count={data?.length}>
      {error && <EmptyState>Couldn&rsquo;t load — {error}</EmptyState>}
      {!error && data === null && <EmptyState>Loading&hellip;</EmptyState>}
      {!error && data?.length === 0 && (
        <EmptyState>Nothing waiting on you right now.</EmptyState>
      )}
      {data?.map((item) => (
        <PanelRow key={item.recording_id}>
          <a
            href={item.app_url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <KindBadge kind={item.kind} />
                <p className="text-sm font-medium truncate group-hover:underline">{item.title}</p>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {item.project_name}
                {item.last_author_name && (
                  <>
                    {" "}
                    &middot; {item.kind === "chat" ? "pinged" : "last reply"}{" "}
                    {relativeTime(item.last_activity_at)} by {item.last_author_name}
                  </>
                )}
              </p>
              {item.excerpt && (
                <p className="text-xs text-[var(--color-text-faint)] mt-1 line-clamp-2">
                  {item.excerpt}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs font-medium text-[var(--color-accent)] mt-0.5">
              Open &rarr;
            </span>
          </a>
        </PanelRow>
      ))}
    </Panel>
  );
}
