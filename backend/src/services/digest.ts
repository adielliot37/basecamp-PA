import { completeJson } from "../ai.js";
import { config } from "../config.js";
import { db } from "../db.js";

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

const MAX_ITEMS = 40;

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
    .prepare(
      "SELECT id, type, title, project_name FROM other_notification ORDER BY created_at_bc DESC LIMIT ?"
    )
    .all(MAX_ITEMS) as NotificationRow[];

  if (items.length === 0) {
    upsertDigest([], "Inbox zero.", null);
    return;
  }

  const idsKey = items
    .map((i) => i.id)
    .sort((a, b) => a - b)
    .join(",");
  const existing = db.prepare("SELECT ids_key, generated_at FROM digest WHERE id = 1").get() as
    | { ids_key: string | null; generated_at: number }
    | undefined;
  if (existing?.ids_key === idsKey) return;

  // Unread notifications churn every poll (mark-read, new reminder, etc.).
  // Do not re-cluster more often than digestMinIntervalMs.
  if (existing?.generated_at && Date.now() - existing.generated_at < config.ai.digestMinIntervalMs) {
    return;
  }

  const result = await completeJson<DigestResult>({
    label: "digest",
    maxTokens: 1024,
    schema: DIGEST_SCHEMA,
    system:
      "You triage Eddy's Basecamp notification feed. Eddy is the Lead Smart Contract Engineer, White Paper " +
      "author, and Scrum Master for ACT.X/BlessUP (a Web3 token + NFT product at NaXum) — his core work is " +
      "smart contract development and audits, tokenomics, the presale/NFT launch-kit, LQA coordination, and " +
      "governance decisions. Weight items touching those areas higher; weight generic HR/admin/promotional " +
      "items lower. Mentions needing a reply are handled elsewhere and are NOT in this list. From what's given, " +
      "flag only items that plausibly need a human glance today (new assignments, comments that look " +
      "substantive, anything unusual) as highlights with a one-line reason each. Everything else (automated " +
      "reminders, routine comments, boosts) goes into one terse routine_summary line grouped by type/project, " +
      "e.g. '18 reminders (mostly OPS: HR PEOPLE), 9 comments, 4 assignments'.",
    user: `Notifications (id | type | title | project):\n${items
      .map((i) => `${i.id} | ${i.type} | ${i.title} | ${i.project_name}`)
      .join("\n")}`
  });

  if (!result) return;
  upsertDigest(result.highlights, result.routine_summary, idsKey);
}
