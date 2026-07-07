"use client";

import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { AddTaskModal } from "@/components/board/AddTaskModal";
import { ActiveTaskRow, CompletedTaskRow, BinTaskRow } from "@/components/board/TaskRow";

export function BoardPanel() {
  const { data, error, refetch } = usePolling(api.personalBoard, 20_000);
  const [showAdd, setShowAdd] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showBin, setShowBin] = useState(false);
  const [purging, setPurging] = useState(false);

  async function emptyBin() {
    if (!window.confirm("Permanently delete everything in the bin? This can't be undone.")) return;
    setPurging(true);
    try {
      await api.emptyPersonalBin();
      refetch();
    } finally {
      setPurging(false);
    }
  }

  return (
    <section className="panel board-home mid">
      <div className="panel-head">
        <div className="head-left">
          <span className="panel-title">My board</span>
          <span className="count">{data?.active.length ?? 0}</span>
        </div>
        <button className="btn-primary btn-small" onClick={() => setShowAdd(true)}>
          + Add
        </button>
      </div>
      <div className="panel-body board-home-body">
        {error && <p className="empty-state">Couldn&rsquo;t load &mdash; {error}</p>}
        {!error && data === null && <p className="empty-state">Loading&hellip;</p>}
        {!error && data?.active.length === 0 && <p className="empty-state">Nothing pinned yet.</p>}
        {data?.active.map((t) => (
          <ActiveTaskRow key={t.id} task={t} onChanged={refetch} />
        ))}

        <button className="board-section-toggle" onClick={() => setShowCompleted((v) => !v)}>
          <span className="section-title">Completed</span>
          <span className="count">{data?.completed.length ?? 0}</span>
          <span className="toggle-caret">{showCompleted ? "−" : "+"}</span>
        </button>
        {showCompleted && (
          <>
            {data?.completed.length === 0 && <p className="empty-state">Nothing completed yet.</p>}
            {data?.completed.map((t) => (
              <CompletedTaskRow key={t.id} task={t} onChanged={refetch} />
            ))}
          </>
        )}

        <button className="board-section-toggle" onClick={() => setShowBin((v) => !v)}>
          <span className="section-title">Bin</span>
          <span className="count">{data?.bin.length ?? 0}</span>
          <span className="toggle-caret">{showBin ? "−" : "+"}</span>
        </button>
        {showBin && (
          <>
            {data && data.bin.length > 0 && (
              <button className="act act-danger board-empty-bin" onClick={emptyBin} disabled={purging}>
                {purging ? "Emptying…" : "Empty bin"}
              </button>
            )}
            {data?.bin.length === 0 && <p className="empty-state">Bin is empty.</p>}
            {data?.bin.map((t) => (
              <BinTaskRow key={t.id} task={t} onChanged={refetch} />
            ))}
          </>
        )}
      </div>
      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} onAdded={refetch} />}
    </section>
  );
}
