"use client";

import { useState } from "react";
import { api, type PersonalTask } from "@/lib/api";
import { dueLabel } from "@/lib/format";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ActiveTaskRow({ task, onChanged }: { task: PersonalTask; onChanged: () => void }) {
  const [completing, setCompleting] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const due = dueLabel(task.due_date);

  async function complete() {
    setBusy(true);
    try {
      await api.completePersonalTask(task.id, completionNote.trim() || undefined);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deletePersonalTask(task.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="board-card">
      <div className="board-card-main">
        <a className="board-card-note" href={task.basecamp_link} target="_blank" rel="noreferrer">
          {task.note}
        </a>
        <div className="board-card-meta">
          <span>Added {formatDate(task.created_at)}</span>
          {task.due_date && <span className={`row-badge due-${due.tone === "danger" ? "overdue" : due.tone === "warning" ? "today" : "stale"}`}>{due.label}</span>}
        </div>
      </div>
      <div className="board-card-actions">
        <button className="act" onClick={() => setCompleting((v) => !v)} disabled={busy}>
          {completing ? "Cancel" : "Mark complete"}
        </button>
        <button className="act act-danger" onClick={remove} disabled={busy}>
          Delete
        </button>
      </div>
      {completing && (
        <div className="board-complete-box">
          <input
            className="board-input"
            placeholder="Optional completion note"
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
          />
          <button className="btn-primary" onClick={complete} disabled={busy}>
            {busy ? "Saving…" : "Confirm complete"}
          </button>
        </div>
      )}
    </div>
  );
}

export function CompletedTaskRow({ task, onChanged }: { task: PersonalTask; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function undo() {
    setBusy(true);
    try {
      await api.uncompletePersonalTask(task.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="board-card board-card-done">
      <div className="board-card-main">
        <a className="board-card-note done" href={task.basecamp_link} target="_blank" rel="noreferrer">
          {task.note}
        </a>
        <div className="board-card-meta">
          <span>Completed {task.completed_at ? formatDate(task.completed_at) : ""}</span>
        </div>
        {task.completion_note && <div className="board-completion-note">{task.completion_note}</div>}
      </div>
      <div className="board-card-actions">
        <button className="act" onClick={undo} disabled={busy}>
          Undo
        </button>
      </div>
    </div>
  );
}

export function BinTaskRow({ task, onChanged }: { task: PersonalTask; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    try {
      await api.restorePersonalTask(task.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (!window.confirm("Delete this permanently? This can't be undone.")) return;
    setBusy(true);
    try {
      await api.purgePersonalTask(task.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="board-card board-card-binned">
      <div className="board-card-main">
        <a className="board-card-note" href={task.basecamp_link} target="_blank" rel="noreferrer">
          {task.note}
        </a>
      </div>
      <div className="board-card-actions">
        <button className="act" onClick={restore} disabled={busy}>
          Restore
        </button>
        <button className="act act-danger" onClick={purge} disabled={busy}>
          Delete forever
        </button>
      </div>
    </div>
  );
}
