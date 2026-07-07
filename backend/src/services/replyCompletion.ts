import "../config.js";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { db } from "../db.js";

const client = new Anthropic();
const MODEL = "claude-haiku-4-5";

/** Obvious "I'll get back to you" phrases — fast path, no API call. */
const DEFERRAL_PATTERNS = [
  /\bi(?:'ll| will)\s+(?:check|look|get back|reply|respond|follow up|circle back|let you know|update you)/i,
  /\blet me\s+(?:check|look|see|get back|review|confirm)/i,
  /\blooking into(?:\s+it)?/i,
  /\bwill\s+(?:check|get back|reply|follow up|circle back|update you)/i,
  /\bget back to you\b/i,
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

/**
 * When Eddy was the last commenter, decide if the thread is truly done
 * (waiting on others) vs. still pending because he only deferred.
 */
export function isStillPendingAfterMyReply(text: string | null | undefined): boolean {
  return isDeferralReply(text);
}

const DEFERRAL_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recording_id: { type: "integer" },
          still_pending: { type: "boolean" }
        },
        required: ["recording_id", "still_pending"],
        additionalProperties: false
      }
    }
  },
  required: ["results"],
  additionalProperties: false
};

interface DeferralResult {
  results: { recording_id: number; still_pending: boolean }[];
}

interface CandidateRow {
  recording_id: number;
  title: string;
  last_comment_text: string;
}

/**
 * AI pass for threads where Eddy spoke last but may have only deferred
 * ("I'll check and reply back") — flips them back to unresolved.
 * Gated like other AI passes to avoid redundant calls.
 */
export async function runDeferralRecheck() {
  const myId = config.basecamp.myPersonId;
  const candidates = db
    .prepare(
      `SELECT recording_id, title, last_comment_text
       FROM needs_reply
       WHERE kind = 'mention'
         AND resolved = 1
         AND last_author_id = ?
         AND last_comment_text IS NOT NULL
         AND last_comment_text != ''
         AND manually_dismissed = 0`
    )
    .all(myId) as CandidateRow[];

  if (candidates.length === 0) return;

  // Heuristic fast-path: obvious deferrals don't need AI
  const heuristicPending: number[] = [];
  const needsAi: CandidateRow[] = [];
  for (const c of candidates) {
    if (isDeferralReply(c.last_comment_text)) {
      heuristicPending.push(c.recording_id);
    } else {
      needsAi.push(c);
    }
  }

  const now = Date.now();
  const reopen = db.prepare(
    "UPDATE needs_reply SET resolved = 0, resolved_at = NULL, updated_at = ? WHERE recording_id = ?"
  );
  for (const id of heuristicPending) {
    reopen.run(now, id);
  }

  if (needsAi.length === 0) return;

  const idsKey = needsAi
    .map((c) => `${c.recording_id}:${c.last_comment_text}`)
    .sort()
    .join("|");
  const existing = db.prepare("SELECT ids_key FROM deferral_state WHERE id = 1").get() as
    | { ids_key: string | null }
    | undefined;
  if (existing?.ids_key === idsKey) return;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "Eddy was the last person to comment on each Basecamp thread below. For each one, decide whether " +
      "his comment actually resolved the thread (substantive answer, decision, or clear handoff) versus " +
      "being an incomplete deferral where he still owes a real follow-up — e.g. 'I'll check and get back', " +
      "'let me look into it', 'will reply soon', 'on it' without an actual answer. " +
      "still_pending=true means Eddy still needs to follow up. Default to still_pending=true when unsure.",
    messages: [
      {
        role: "user",
        content: needsAi
          .map(
            (c) =>
              `recording_id: ${c.recording_id}\ntitle: ${c.title}\nEddy's last comment: ${c.last_comment_text}`
          )
          .join("\n---\n")
      }
    ],
    output_config: { format: { type: "json_schema", schema: DEFERRAL_SCHEMA } }
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return;
  const parsed = JSON.parse(textBlock.text) as DeferralResult;

  for (const r of parsed.results) {
    if (r.still_pending) reopen.run(now, r.recording_id);
  }

  db.prepare(
    `INSERT INTO deferral_state (id, ids_key, checked_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ids_key = excluded.ids_key, checked_at = excluded.checked_at`
  ).run(idsKey, now);
}
