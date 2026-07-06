"use client";

import { usePolling } from "@/hooks/usePolling";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function ReportsPanel() {
  const { data } = usePolling(api.reportsDue, 60_000);
  const posted = !!data?.posted_today;

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
      </div>
    </section>
  );
}
