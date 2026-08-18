import { config } from "../config.js";
import { db } from "../db.js";

/** Obvious "I'll get back to you" phrases — no model call. */
const DEFERRAL_PATTERNS = [
  /\bi(?:'ll| will)\s+(?:check|look|get back|reply|respond|follow up|circle back|let you know|update you)/i,
  /\blet me\s+(?:check|look|see|get back|review|confirm)/i,
  /\blooking into(?:\s+it)?/i,
  /\bwill\s+(?:check|get back|reply|follow up|circle back|update you)/i,
  /\bget back to you\b/i,
  /\bi(?:'ll| will)\s+check and reply/i,
  /\breply(?:\s+back)?(?:\s+soon|\s+later|\s+when|\s+once)?/i,
  /\bgive me (?:a )?(?:moment|minute|sec)/i,
  /\bneed to (?:check|look|verify|confirm)/i,
  /\bstill (?:checking|looking|investigating)/i
];

export function isDeferralReply(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  return DEFERRAL_PATTERNS.some((p) => p.test(normalized));
}

export function isStillPendingAfterMyReply(text: string | null | undefined): boolean {
  return isDeferralReply(text);
}

/**
 * Re-open threads Eddy "resolved" only by promising a later reply.
 * Heuristic only — scanning every historical Eddy-last comment with a model
 * (and defaulting to still-pending) was reopening the inbox every poll.
 */
export function runDeferralRecheck() {
  const rows = db
    .prepare(
      `SELECT recording_id, last_comment_text
       FROM needs_reply
       WHERE kind = 'mention'
         AND resolved = 1
         AND last_author_id = ?
         AND last_comment_text IS NOT NULL
         AND last_comment_text != ''
         AND manually_dismissed = 0`
    )
    .all(config.basecamp.myPersonId) as Array<{ recording_id: number; last_comment_text: string }>;

  const now = Date.now();
  const reopen = db.prepare(
    "UPDATE needs_reply SET resolved = 0, resolved_at = NULL, updated_at = ? WHERE recording_id = ?"
  );
  for (const row of rows) {
    if (isDeferralReply(row.last_comment_text)) reopen.run(now, row.recording_id);
  }
}
