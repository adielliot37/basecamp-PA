import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { db } from "./db.js";

const HAIKU = "claude-haiku-4-5";

let client: Anthropic | null = null;
let loggedDisabled = false;
let loggedBudget = "";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isAiEnabled(): boolean {
  return Boolean(config.ai.apiKey);
}

function getClient(): Anthropic | null {
  if (!isAiEnabled()) {
    if (!loggedDisabled) {
      console.log("AI disabled — ANTHROPIC_API_KEY is not set; Basecamp sync continues without model calls.");
      loggedDisabled = true;
    }
    return null;
  }
  if (!client) client = new Anthropic({ apiKey: config.ai.apiKey });
  return client;
}

function usageRow(): { day: string; calls: number } {
  const row = db.prepare("SELECT day, calls FROM ai_usage WHERE id = 1").get() as
    | { day: string; calls: number }
    | undefined;
  const day = todayKey();
  if (!row) {
    db.prepare("INSERT INTO ai_usage (id, day, calls, last_call_at) VALUES (1, ?, 0, NULL)").run(day);
    return { day, calls: 0 };
  }
  if (row.day !== day) {
    db.prepare("UPDATE ai_usage SET day = ?, calls = 0, last_call_at = NULL WHERE id = 1").run(day);
    return { day, calls: 0 };
  }
  return row;
}

function remainingBudget(): number {
  const { day, calls } = usageRow();
  const left = config.ai.maxCallsPerDay - calls;
  if (left <= 0 && loggedBudget !== day) {
    console.warn(`AI daily budget exhausted (${calls}/${config.ai.maxCallsPerDay} calls on ${day}); skipping further model calls today.`);
    loggedBudget = day;
  }
  return left;
}

function recordCall() {
  usageRow(); // roll the counter if the UTC day changed
  db.prepare("UPDATE ai_usage SET calls = calls + 1, last_call_at = ? WHERE id = 1").run(Date.now());
}

/**
 * One Haiku JSON-schema call. Returns parsed JSON or null when AI is off,
 * over budget, or the request failed. Records the attempt *before* the
 * HTTP call so a parse/network failure cannot retry-storm every 75s poll.
 */
export async function completeJson<T>(opts: {
  label: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  if (remainingBudget() <= 0) return null;

  recordCall();
  const { calls } = usageRow();
  console.log(`AI ${opts.label}: call ${calls}/${config.ai.maxCallsPerDay} today`);

  try {
    const response = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { format: { type: "json_schema", schema: opts.schema } }
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.error(`AI ${opts.label}: no text block in response`);
      return null;
    }
    return JSON.parse(textBlock.text) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`AI ${opts.label} failed:`, message);
    return null;
  }
}
