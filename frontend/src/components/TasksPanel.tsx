"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { dueLabel } from "@/lib/format";
import { Panel, EmptyState, PanelRow } from "./Panel";

const toneClass: Record<string, string> = {
  danger: "text-[var(--color-danger)]",
  warning: "text-[var(--color-warning)]",
  muted: "text-[var(--color-text-muted)]",
};

export function TasksPanel() {
  const { data, error } = usePolling(api.tasks, 45_000);

  return (
    <Panel title="My active tasks" count={data?.length}>
      {error && <EmptyState>Couldn&rsquo;t load — {error}</EmptyState>}
      {!error && data === null && <EmptyState>Loading&hellip;</EmptyState>}
      {!error && data?.length === 0 && <EmptyState>No open assignments.</EmptyState>}
      {data?.map((task) => {
        const due = dueLabel(task.due_on);
        return (
          <PanelRow key={task.todo_id}>
            <a
              href={task.app_url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate group-hover:underline">{task.title}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{task.project_name}</p>
              </div>
              <span className={`shrink-0 text-xs font-medium mt-0.5 ${toneClass[due.tone]}`}>
                {due.label}
              </span>
            </a>
          </PanelRow>
        );
      })}
    </Panel>
  );
}
