"use client";

import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  pending: "Planned",
  executed: "Posted",
  failed: "Failed",
  cancelled: "Not planned"
};

function istTime(scheduledAtIst: string | null): string {
  if (!scheduledAtIst) return "";
  const parts = scheduledAtIst.split(" ");
  return parts.length >= 2 ? parts[1] : scheduledAtIst;
}

export function ReportsPanel() {
  const { data } = usePolling(api.reportsDue, 60_000);
  const { data: automation } = usePolling(api.reportAutomation, 60_000);
  const posted = !!data?.posted_today;
  const [showDraft, setShowDraft] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const today = automation?.today ?? null;
  const isGood = !!today && (today.status === "pending" || today.status === "executed");

  return (
    <section className="panel reports">
      <div className="panel-head">
        <div className="head-left">
          <span className="panel-title">Reports due</span>
          <span className="count">{posted ? 0 : 1}</span>
        </div>
      </div>
      <div className="panel-body">
        <a
          href={data?.app_url ?? undefined}
          target="_blank"
          rel="noreferrer"
          style={{ display: "block", color: "inherit" }}
        >
          <div className={`eos-block ${posted ? "ok" : ""}`}>
            <div>
              <div className="t">Today&rsquo;s EOS report</div>
              <div className="s">
                7-point end-of-shift &middot;{" "}
                {posted && data?.last_posted_at
                  ? `posted ${relativeTime(data.last_posted_at)}`
                  : "post before EOD"}
              </div>
            </div>
            <span className="tag">{posted ? "Posted" : "Not posted"}</span>
          </div>
        </a>

        <div className={`automation-block ${isGood ? "ok" : "bad"}`}>
          <button
            className="automation-toggle"
            onClick={() => setShowDraft((v) => !v)}
            disabled={!today}
          >
            <span className="automation-dot" />
            <div className="automation-main">
              <div className="t">
                {today ? `${STATUS_LABEL[today.status] ?? today.status} · ${istTime(today.scheduled_at_ist)} IST` : "Not planned yet"}
              </div>
              <div className="s">Daily-report automation</div>
            </div>
            {today && <span className="toggle-caret">{showDraft ? "−" : "+"}</span>}
          </button>
          {showDraft && today && (
            <div className="automation-draft">
              {today.status === "failed" && today.error_msg && (
                <p className="board-error">{today.error_msg}</p>
              )}
              <div className="draft-body">{today.comment_text}</div>
            </div>
          )}
        </div>

        <button className="board-section-toggle" onClick={() => setShowHistory((v) => !v)}>
          <span className="section-title">Automation history</span>
          <span className="count">{automation?.history.length ?? 0}</span>
          <span className="toggle-caret">{showHistory ? "−" : "+"}</span>
        </button>
        {showHistory && (
          <div className="automation-history">
            {automation && automation.history.length === 0 && (
              <p className="empty-state">No automation history yet.</p>
            )}
            {automation?.history.map((h) => (
              <div className="row" key={h.remote_id}>
                <span
                  className="row-dot"
                  style={{
                    background:
                      h.status === "executed"
                        ? "var(--pri-low-dot)"
                        : h.status === "failed"
                          ? "var(--pri-high-dot)"
                          : h.status === "cancelled"
                            ? "var(--due-stale-fg)"
                            : "var(--pri-med-dot)"
                  }}
                />
                <div className="row-main">
                  <div className="row-title">{h.scheduled_at_ist ?? "—"}</div>
                  <div className="row-sub">{STATUS_LABEL[h.status] ?? h.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
