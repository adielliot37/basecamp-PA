"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

const COLOR_BY_TYPE: Record<string, string> = {
  Chat: "#8a2be2",
  Assignment: "#d4a017",
  Reminder: "#c0392b",
  Comment: "#5bbfe1",
  Message: "#dd6997",
  Completion: "#5ba658",
  waiting: "#5bbfe1"
};

export function OtherPanel() {
  const { data: digest, error: digestError } = usePolling(api.other, 45_000);
  const { data: waitingOn } = usePolling(api.waitingOn, 45_000);

  const waitingRows = (waitingOn ?? []).map((w) => ({
    key: `waiting-${w.recording_id}`,
    color: COLOR_BY_TYPE.waiting,
    title: w.title,
    sub: `${w.project_name} · you followed up`,
    time: relativeTime(w.last_activity_at),
    url: w.app_url
  }));

  const highlightRows = (digest?.highlights ?? []).map((h) => ({
    key: `hl-${h.id}`,
    color: COLOR_BY_TYPE[h.type] ?? "#8b8c8e",
    title: h.title,
    sub: h.reason,
    time: relativeTime(h.created_at_bc),
    url: h.app_url
  }));

  const rows = [...waitingRows, ...highlightRows];
  const totalCount = rows.length + (digest?.total ?? 0) - (digest?.highlights.length ?? 0);

  return (
    <section className="panel else">
      <div className="panel-head">
        <div className="head-left">
          <span className="panel-title">Everything else</span>
          <span className="count">{totalCount}</span>
        </div>
        <span className="head-note">pings &middot; todos &middot; check-ins</span>
      </div>
      <div className="panel-body">
        {digestError && <p className="empty-state">Couldn&rsquo;t load &mdash; {digestError}</p>}
        {!digestError && digest === null && <p className="empty-state">Loading&hellip;</p>}
        {!digestError && digest && rows.length === 0 && <p className="empty-state">Inbox zero.</p>}
        {rows.map((r) => (
          <div className="row" key={r.key}>
            <a href={r.url} target="_blank" rel="noreferrer">
              <span className="row-dot" style={{ background: r.color }} />
              <div className="row-main">
                <div className="row-title">{r.title}</div>
                <div className="row-sub">{r.sub}</div>
              </div>
              <div className="row-right">
                <span className="row-meta">{r.time}</span>
              </div>
            </a>
          </div>
        ))}
        {digest?.routineSummary && (
          <p className="empty-state" style={{ padding: "4px 4px 0", textAlign: "left" }}>
            {digest.routineSummary}
          </p>
        )}
      </div>
    </section>
  );
}
