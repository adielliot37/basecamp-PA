"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function TopBar() {
  const { data: status } = usePolling(api.status, 30_000);
  const { data: reportsDue } = usePolling(api.reportsDue, 60_000);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Basecamp Cockpit</div>
          <div className="brand-sub">Eddy&rsquo;s ops radar &middot; nothing slips</div>
        </div>
      </div>
      <div className="topbar-right">
        <span className="chip">
          <span className="dot-live" />
          {status?.last_ok_at ? `Synced ${relativeTime(status.last_ok_at)}` : "Connecting…"}
        </span>
        <span className={`chip chip-eos ${reportsDue?.posted_today ? "ok" : ""}`}>
          <svg className="i" viewBox="0 0 24 24">
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          EOS report &middot; {reportsDue?.posted_today ? "Posted" : "Missing"}
        </span>
      </div>
    </header>
  );
}
