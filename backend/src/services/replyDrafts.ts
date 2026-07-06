import "../config.js";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db.js";

const client = new Anthropic();

// Drafting words Eddy will actually copy-paste and send is a step up in stakes
// from the clustering/classification passes (digest, relevance filter) — worth
// Sonnet over Haiku here. Still bounded: only the small set of currently-open
// reply threads, and gated to skip unchanged content.
const MODEL = "claude-sonnet-5";

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

/**
 * Generates, per open thread: a one-line "what's being asked", a copy-ready
 * draft reply, and a priority. Draft-only — this never posts anything; Eddy
 * copies it into Basecamp himself if he wants it. Gated to only run when the
 * open-thread content actually changes, so it doesn't re-draft on every poll.
 */
export async function runReplyDrafts() {
  const candidates = db
    .prepare(
      `SELECT recording_id, title, project_name, last_author_name, last_comment_text
       FROM needs_reply
       WHERE resolved = 0`
    )
    .all() as CandidateRow[];

  if (candidates.length === 0) return;

  const idsKey = candidates
    .map((c) => `${c.recording_id}:${c.last_comment_text ?? ""}`)
    .sort()
    .join("|");
  const existing = db.prepare("SELECT ids_key FROM draft_state WHERE id = 1").get() as
    | { ids_key: string | null }
    | undefined;
  if (existing?.ids_key === idsKey) return;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "disabled" },
    system:
      "You draft short, direct Basecamp reply suggestions for Eddy, a smart contract engineer at NaXum. For " +
      "each thread: 'ask' is one plain sentence stating what's actually being asked of him. 'draft' is a " +
      "complete, copy-paste-ready reply in Eddy's voice — concise, direct, no filler, signed '— Eddy' only if " +
      "the thread's tone calls for a sign-off. If the thread has no real text (e.g. a chat ping with no content, " +
      "or an attachment-only comment), write a generic-but-useful ask/draft acknowledging you'll follow up. " +
      "'priority' is high (blocking someone or time-sensitive), med (real but not urgent), or low (minor/FYI-ish).",
    messages: [
      {
        role: "user",
        content: candidates
          .map(
            (c) =>
              `recording_id: ${c.recording_id}\ntitle: ${c.title}\nproject: ${c.project_name}\nlast comment by: ${c.last_author_name ?? "unknown"}\nlast comment: ${c.last_comment_text || "(no text)"}`
          )
          .join("\n---\n")
      }
    ],
    output_config: { format: { type: "json_schema", schema: DRAFTS_SCHEMA } }
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return;
  const parsed = JSON.parse(textBlock.text) as DraftsResult;

  const update = db.prepare(
    "UPDATE needs_reply SET ask = ?, draft_reply = ?, ai_priority = ? WHERE recording_id = ?"
  );
  for (const r of parsed.results) {
    update.run(r.ask, r.draft, r.priority, r.recording_id);
  }

  db.prepare(
    `INSERT INTO draft_state (id, ids_key, generated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ids_key = excluded.ids_key, generated_at = excluded.generated_at`
  ).run(idsKey, Date.now());
}
