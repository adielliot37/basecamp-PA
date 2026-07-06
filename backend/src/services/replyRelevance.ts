import "../config.js";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db.js";

const client = new Anthropic();
const MODEL = "claude-haiku-4-5";

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

/**
 * Comment-order alone can't tell "someone left me a real question" from "someone
 * posted a confirmation screenshot with no ask" — found via a real false
 * positive: a thread's last comment was just image attachments (a completed-review
 * screenshot), so it kept showing as open even though nothing was actually being
 * asked. This is exactly the kind of judgment call worth spending a cheap model
 * call on, gated to only the small set of currently-open threads.
 */
export async function runReplyRelevanceFilter() {
  const candidates = db
    .prepare(
      `SELECT recording_id, title, last_author_name, last_comment_text
       FROM needs_reply
       WHERE kind = 'mention' AND resolved = 0 AND last_comment_text IS NOT NULL AND last_comment_text != ''`
    )
    .all() as CandidateRow[];

  if (candidates.length === 0) return;

  const idsKey = candidates
    .map((c) => `${c.recording_id}:${c.last_comment_text}`)
    .sort()
    .join("|");
  const existing = db.prepare("SELECT ids_key FROM relevance_state WHERE id = 1").get() as
    | { ids_key: string | null }
    | undefined;
  if (existing?.ids_key === idsKey) return; // same open set as last check — skip the API call

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "For each Basecamp thread below, decide whether the last comment actually asks Eddy for a reply, " +
      "decision, or input — versus being a pure FYI, confirmation, status update, or an attachment/screenshot " +
      "with no real question attached. Default to needs_reply=true when genuinely unsure — the cost of a false " +
      "'still open' is much lower than silently dropping something Eddy actually needed to answer.",
    messages: [
      {
        role: "user",
        content: candidates
          .map(
            (c) =>
              `recording_id: ${c.recording_id}\ntitle: ${c.title}\nlast comment by: ${c.last_author_name ?? "unknown"}\nlast comment text: ${c.last_comment_text || "(no text — attachment/image only)"}`
          )
          .join("\n---\n")
      }
    ],
    output_config: { format: { type: "json_schema", schema: RELEVANCE_SCHEMA } }
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return;
  const parsed = JSON.parse(textBlock.text) as RelevanceResult;

  const resolve = db.prepare("UPDATE needs_reply SET resolved = 1, resolved_at = ? WHERE recording_id = ?");
  const now = Date.now();
  for (const r of parsed.results) {
    if (!r.needs_reply) resolve.run(now, r.recording_id);
  }

  db.prepare(
    `INSERT INTO relevance_state (id, ids_key, checked_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ids_key = excluded.ids_key, checked_at = excluded.checked_at`
  ).run(idsKey, now);
}
