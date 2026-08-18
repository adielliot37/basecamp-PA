import { completeJson } from "../ai.js";
import { db } from "../db.js";

const RELEVANCE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recording_id: { type: "integer" },
          needs_reply: { type: "boolean" }
        },
        required: ["recording_id", "needs_reply"],
        additionalProperties: false
      }
    }
  },
  required: ["results"],
  additionalProperties: false
};

interface RelevanceResult {
  results: { recording_id: number; needs_reply: boolean }[];
}

interface CandidateRow {
  recording_id: number;
  title: string;
  last_author_name: string | null;
  last_comment_text: string;
}

const MAX_BATCH = 12;

/**
 * Comment-order alone can't tell "someone left me a real question" from "someone
 * posted a confirmation screenshot with no ask". Cheap Haiku judgment, but only
 * for threads whose last comment has not already been classified — re-running
 * the whole open set every poll was the old credit leak.
 */
export async function runReplyRelevanceFilter() {
  const candidates = db
    .prepare(
      `SELECT recording_id, title, last_author_name, last_comment_text
       FROM needs_reply
       WHERE kind = 'mention'
         AND resolved = 0
         AND last_comment_text IS NOT NULL AND last_comment_text != ''
         AND (ai_verdict IS NULL OR ai_verdict != last_comment_text)
       ORDER BY COALESCE(last_activity_at, mentioned_at) DESC
       LIMIT ?`
    )
    .all(MAX_BATCH) as CandidateRow[];

  if (candidates.length === 0) return;

  const parsed = await completeJson<RelevanceResult>({
    label: "relevance",
    maxTokens: 1024,
    schema: RELEVANCE_SCHEMA,
    system:
      "For each Basecamp thread below, decide whether the last comment actually asks Eddy for a reply, " +
      "decision, or input — versus being a pure FYI, confirmation, status update, or an attachment/screenshot " +
      "with no real question attached. Default to needs_reply=true when genuinely unsure — the cost of a false " +
      "'still open' is much lower than silently dropping something Eddy actually needed to answer.",
    user: candidates
      .map(
        (c) =>
          `recording_id: ${c.recording_id}\ntitle: ${c.title}\nlast comment by: ${c.last_author_name ?? "unknown"}\nlast comment text: ${c.last_comment_text || "(no text — attachment/image only)"}`
      )
      .join("\n---\n")
  });

  if (!parsed) return;

  const now = Date.now();
  const stamp = db.prepare(
    `UPDATE needs_reply
     SET ai_verdict = last_comment_text,
         resolved = CASE WHEN ? = 0 THEN 1 ELSE resolved END,
         resolved_at = CASE WHEN ? = 0 AND resolved = 0 THEN ? ELSE resolved_at END,
         updated_at = ?
     WHERE recording_id = ?`
  );
  const byId = new Map(parsed.results.map((r) => [r.recording_id, r.needs_reply]));
  for (const c of candidates) {
    const needs = byId.get(c.recording_id) ?? true;
    const flag = needs ? 1 : 0;
    stamp.run(flag, flag, now, now, c.recording_id);
  }
}
