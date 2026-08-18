import { completeJson } from "../ai.js";
import { db } from "../db.js";

const DRAFTS_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recording_id: { type: "integer" },
          ask: { type: "string" },
          draft: { type: "string" },
          priority: { type: "string", enum: ["high", "med", "low"] }
        },
        required: ["recording_id", "ask", "draft", "priority"],
        additionalProperties: false
      }
    }
  },
  required: ["results"],
  additionalProperties: false
};

interface DraftsResult {
  results: { recording_id: number; ask: string; draft: string; priority: string }[];
}

interface CandidateRow {
  recording_id: number;
  title: string;
  project_name: string;
  last_author_name: string | null;
  last_comment_text: string | null;
}

const MAX_BATCH = 8;

/**
 * Per open thread: one-line ask, copy-ready draft, priority. Draft-only —
 * never posts. Haiku is enough for short Basecamp replies; Sonnet-on-every-poll
 * was the main credit sink. Only threads whose last comment changed (or that
 * have no draft yet) are sent, so a new ping does not re-draft the whole inbox.
 */
export async function runReplyDrafts() {
  const candidates = db
    .prepare(
      `SELECT recording_id, title, project_name, last_author_name, last_comment_text
       FROM needs_reply
       WHERE resolved = 0
         AND (draft_source_text IS NULL OR draft_source_text != IFNULL(last_comment_text, ''))
       ORDER BY COALESCE(last_activity_at, mentioned_at) DESC
       LIMIT ?`
    )
    .all(MAX_BATCH) as CandidateRow[];

  if (candidates.length === 0) return;

  const parsed = await completeJson<DraftsResult>({
    label: "drafts",
    maxTokens: 2048,
    schema: DRAFTS_SCHEMA,
    system:
      "You draft short, direct Basecamp reply suggestions for Eddy, a smart contract engineer at NaXum. For " +
      "each thread: 'ask' is one plain sentence stating what's actually being asked of him. If Eddy already " +
      "commented with a deferral ('I'll check', 'will get back'), the ask should note he promised to follow up " +
      "and still owes a real answer. 'draft' is a complete, copy-paste-ready reply in Eddy's voice — concise, " +
      "direct, no filler, signed '— Eddy' only if the thread's tone calls for a sign-off. If the thread has no " +
      "real text (e.g. a chat ping with no content, or an attachment-only comment), write a generic-but-useful " +
      "ask/draft acknowledging you'll follow up. 'priority' is high (blocking someone or time-sensitive), med " +
      "(real but not urgent), or low (minor/FYI-ish). Deferred follow-ups you still owe count as med or high.",
    user: candidates
      .map(
        (c) =>
          `recording_id: ${c.recording_id}\ntitle: ${c.title}\nproject: ${c.project_name}\nlast comment by: ${c.last_author_name ?? "unknown"}\nlast comment: ${c.last_comment_text || "(no text)"}`
      )
      .join("\n---\n")
  });

  if (!parsed) return;

  const update = db.prepare(
    "UPDATE needs_reply SET ask = ?, draft_reply = ?, ai_priority = ?, draft_source_text = IFNULL(last_comment_text, '') WHERE recording_id = ?"
  );
  for (const r of parsed.results) {
    update.run(r.ask, r.draft, r.priority, r.recording_id);
  }
}
