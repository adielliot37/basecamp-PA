import { config } from "./config.js";
import { db } from "./db.js";
import { runWatchSetDiscovery } from "./services/watchset.js";
import { runNeedsReplyPass } from "./services/needsReply.js";
import { runAssignmentsSync } from "./services/assignments.js";
import { runOtherNotificationsSync } from "./services/otherNotifications.js";
import { runReportsDueCheck } from "./services/reportsDue.js";
import { runDigest } from "./services/digest.js";
import { runChatPingsPass } from "./services/chatPings.js";
import { runReplyRelevanceFilter } from "./services/replyRelevance.js";
import { runDeferralRecheck } from "./services/replyCompletion.js";
import { runReplyDrafts } from "./services/replyDrafts.js";
import { isAiEnabled } from "./ai.js";

async function tick() {
  try {
    await runWatchSetDiscovery();
    await runNeedsReplyPass();
    await runChatPingsPass();
    await runAssignmentsSync();
    await runOtherNotificationsSync();
    await runReportsDueCheck();
    runDeferralRecheck();
    await runAiPasses();
    db.prepare("UPDATE poller_state SET last_run_at = ?, last_ok_at = ?, last_error = NULL WHERE id = 1").run(
      Date.now(),
      Date.now()
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Poller tick failed:", message);
    db.prepare("UPDATE poller_state SET last_run_at = ?, last_error = ? WHERE id = 1").run(Date.now(), message);
  }
}

/** Model calls are isolated so a missing key / API error never blocks Basecamp sync. */
async function runAiPasses() {
  if (!isAiEnabled()) return;
  for (const [name, fn] of [
    ["relevance", runReplyRelevanceFilter],
    ["drafts", runReplyDrafts],
    ["digest", runDigest]
  ] as const) {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`AI ${name} failed:`, message);
    }
  }
}

export function startPoller() {
  tick();
  setInterval(tick, config.pollIntervalMs);
}
