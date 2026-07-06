"use client";

import { usePolling } from "@/hooks/usePolling";
import { api, type TaskItem } from "@/lib/api";

const FLAG_BADGE: Record<string, { cls: string; label: string }> = {
  overdue: { cls: "due-overdue", label: "Overdue" },
  today: { cls: "due-today", label: "Due today" },
};

function TaskRow({ task }: { task: TaskItem }) {
  const badge = FLAG_BADGE[task.flag];
  return (
    <div className="row">
      <a href={task.app_url} target="_blank" rel="noreferrer">
        <span className="row-dot" style={{ background: `var(--pri-${task.priority}-dot)` }} />
        <div className="row-main">
          <div className="row-title">{task.title}</div>
          <div className="row-sub">{task.project_name}</div>
        </div>
        <div className="row-right">
          {badge && <span className={`row-badge ${badge.cls}`}>{badge.label}</span>}
        </div>
      </a>
    </div>
  );
}

export function TasksPanel() {
  const { data, error } = usePolling(api.tasks, 45_000);
  const attentionCount = data?.filter((t) => t.flag !== "ok").length ?? 0;

  return (
    <section className="panel mid">
      <div className="panel-head">
        <div className="head-left">
          <span className="panel-title">My active tasks</span>
          <span className="count">{data?.length ?? 0}</span>
        </div>
        {attentionCount > 0 && <span className="head-note attn">{attentionCount} need attention</span>}
      </div>
      <div className="panel-body">
        {error && <p className="empty-state">Couldn&rsquo;t load &mdash; {error}</p>}
        {!error && data === null && <p className="empty-state">Loading&hellip;</p>}
        {!error && data?.length === 0 && <p className="empty-state">No open assignments.</p>}
        {data?.map((t) => (
          <TaskRow key={t.todo_id} task={t} />
        ))}
      </div>
    </section>
  );
}
