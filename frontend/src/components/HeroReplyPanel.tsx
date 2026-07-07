"use client";

import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api, type NeedsReplyItem } from "@/lib/api";
import { relativeTime } from "@/lib/format";

const PROJECT_COLORS = ["#8a2be2", "#5bbfe1", "#5ba658", "#d4a017", "#dd6997", "#c0392b"];
function projectColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

const PRI_LABEL: Record<string, string> = { high: "High", med: "Medium", low: "Low" };

const CLOCK = (
  <svg className="i" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

function ReplyCard({ item, onResolved }: { item: NeedsReplyItem; onResolved: () => void }) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [copied, setCopied] = useState(false);
  const priority = item.ai_priority ?? "med";
  const deferred = item.reply_state === "deferred_by_me";

  async function toggleResolve() {
    const next = !resolved;
    setResolving(true);
    try {
      await api.resolveNeedsReply(item.recording_id, next);
      setResolved(next);
      if (next) onResolved();
    } finally {
      setResolving(false);
    }
  }

  return (
    <article className={`reply ${open ? "open" : ""} ${resolved ? "resolved" : ""} ${deferred ? "deferred" : ""}`}>
      <div className="reply-top">
        <div className="proj">
          <span className="proj-dot" style={{ background: projectColor(item.project_name) }} />
          <span className="proj-name">{item.project_name}</span>
        </div>
        <div className="reply-badges">
          {deferred && <span className="badge badge-deferred">Follow-up owed</span>}
          <span className={`badge pri-${priority}`}>{PRI_LABEL[priority]}</span>
        </div>
      </div>
      <div className="reply-title">{item.title}</div>
      <div className="reply-snippet">
        {deferred ? (
          <>
            <b>You </b>
            said you&rsquo;d follow up — still pending a real answer.
          </>
        ) : (
          <>
            {item.last_author_name && <b>{item.last_author_name} </b>}
            {item.kind === "chat" ? "sent you a direct ping." : item.excerpt || "Mentioned you in a comment."}
          </>
        )}
      </div>
      <div className="reply-foot">
        <span className="time">
          {CLOCK} {relativeTime(item.last_activity_at ?? item.mentioned_at)}
        </span>
        <div className="actions">
          <button className="act act-draft" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide draft" : "Draft"}
          </button>
          <a className="act" href={item.app_url} target="_blank" rel="noreferrer">
            Open
            <svg className="i" viewBox="0 0 24 24">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </a>
          <button className="act" onClick={toggleResolve} disabled={resolving}>
            {resolved ? "Undo" : "Resolve"}
          </button>
        </div>
      </div>
      <div className="draftbox">
        <div className="draft-label">
          <svg className="i" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M12 2l1.6 4.9L18.5 8.5 13.6 10 12 15l-1.6-5L5.5 8.5z" />
          </svg>
          AI &middot; what&rsquo;s being asked
        </div>
        <div className="draft-ask">{item.ask ?? "Analyzing…"}</div>
        <div className="draft-body">{item.draft_reply ?? "Draft generating on the next sync…"}</div>
        <div className="draft-foot">
          <button
            className="btn-copy"
            onClick={() => {
              if (!item.draft_reply) return;
              navigator.clipboard?.writeText(item.draft_reply);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "Copied ✓" : "Copy draft"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function HeroReplyPanel() {
  const { data, error, refetch } = usePolling(api.needsReply, 25_000);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visible = data?.filter((item) => !dismissed.has(item.recording_id)) ?? [];

  function handleResolved(id: number) {
    setDismissed((prev) => new Set(prev).add(id));
    refetch();
  }

  return (
    <section className="panel hero">
      <div className="hero-head">
        <div>
          <div className="eyebrow">Headline &middot; the notification fix</div>
          <div className="hero-title">Needs my reply</div>
          <div className="hero-note">Persisted until you reply &mdash; won&rsquo;t vanish like the bell.</div>
        </div>
        <span className="hero-count">{visible.length}</span>
      </div>
      <div className="hero-body">
        {error && <p className="empty-state">Couldn&rsquo;t load &mdash; {error}</p>}
        {!error && data === null && <p className="empty-state">Loading&hellip;</p>}
        {!error && visible.length === 0 && <p className="empty-state">Nothing waiting on you right now.</p>}
        {visible.map((item) => (
          <ReplyCard key={item.recording_id} item={item} onResolved={() => handleResolved(item.recording_id)} />
        ))}
      </div>
    </section>
  );
}
