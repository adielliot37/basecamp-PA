import "../config.js"; // ensure dotenv has loaded before the client reads ANTHROPIC_API_KEY
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db.js";

const client = new Anthropic();

// Clustering ~40 short notification titles is a cheap, low-stakes task —
// Haiku 4.5 is the right tier here, not Opus. Bump per-task if the ask changes.
const MODEL = "claude-haiku-4-5";

const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          reason: { type: "string" }
        },
        required: ["id", "reason"],
        additionalProperties: false
      }
    },
    routine_summary: { type: "string" }
  },
  required: ["highlights", "routine_summary"],
  additionalProperties: false
};

interface DigestResult {
  highlights: { id: number; reason: string }[];
  routine_summary: string;
}

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  project_name: string;
}

function upsertDigest(highlights: DigestResult["highlights"], routineSummary: string, idsKey: string | null) {
  db.prepare(
    `INSERT INTO digest (id, highlights_json, routine_summary, ids_key, generated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       highlights_json = excluded.highlights_json,
       routine_summary = excluded.routine_summary,
       ids_key = excluded.ids_key,
       generated_at = excluded.generated_at`
  ).run(JSON.stringify(highlights), routineSummary, idsKey, Date.now());
}

export async function runDigest() {
  const items = db
    .prepare("SELECT id, type, title, project_name FROM other_notification ORDER BY created_at_bc DESC")
    .all() as NotificationRow[];

  if (items.length === 0) {
    upsertDigest([], "Inbox zero.", null);
    return;
  }

  const idsKey = items
    .map((i) => i.id)
    .sort((a, b) => a - b)
    .join(",");
  const existing = db.prepare("SELECT ids_key FROM digest WHERE id = 1").get() as
    | { ids_key: string | null }
    | undefined;
  if (existing?.ids_key === idsKey) return; // nothing new since the last digest — skip the API call

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "You triage a busy engineer's Basecamp notification feed. Mentions needing a reply are handled elsewhere " +
      "and are NOT in this list. From what's given, flag only items that plausibly need a human glance today " +
      "(new assignments, comments that look substantive, anything unusual) as highlights with a one-line reason " +
      "each. Everything else (automated reminders, routine comments, boosts) goes into one terse routine_summary " +
      "line grouped by type/project, e.g. '18 reminders (mostly OPS: HR PEOPLE), 9 comments, 4 assignments'.",
    messages: [
      {
        role: "user",
        content: `Notifications (id | type | title | project):\n${items
          .map((i) => `${i.id} | ${i.type} | ${i.title} | ${i.project_name}`)
          .join("\n")}`
      }
    ],
    output_config: { format: { type: "json_schema", schema: DIGEST_SCHEMA } }
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Digest: no text block in response");
  const result = JSON.parse(textBlock.text) as DigestResult;

  upsertDigest(result.highlights, result.routine_summary, idsKey);
}
