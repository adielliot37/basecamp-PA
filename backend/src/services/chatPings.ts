import { bcFetch } from "../basecamp/client.js";
import { db } from "../db.js";

interface Reading {
  id: number;
  type: string;
  app_url: string;
  bucket_name: string;
  updated_at: string;
  creator?: { name: string };
}
interface ReadingsResponse {
  unreads: Reading[];
}

/**
 * Direct chat pings (Campfire/circle DMs) deserve the same urgency as a
 * mention — Basecamp reuses one notification record per thread and just
 * bumps `updated_at`/`unread_count`, so recency must come from `updated_at`,
 * not the thread's original `created_at` (which can be months stale).
 */
export async function runChatPingsPass() {
  const { unreads } = await bcFetch<ReadingsResponse>("/my/readings.json");
  const pings = unreads.filter((n) => n.type === "Chat");
  const now = Date.now();
  const seenIds = new Set<number>();

  for (const p of pings) {
    seenIds.add(p.id);
    const lastActivity = Date.parse(p.updated_at);
    const pinger = p.creator?.name ?? "someone";
    const existing = db.prepare("SELECT recording_id FROM needs_reply WHERE recording_id = ?").get(p.id);

    if (existing) {
      db.prepare(
        `UPDATE needs_reply
         SET last_author_name = ?, last_activity_at = ?, resolved = 0, updated_at = ?
         WHERE recording_id = ?`
      ).run(pinger, lastActivity, now, p.id);
    } else {
      db.prepare(
        `INSERT INTO needs_reply
          (kind, recording_id, project_id, project_name, title, app_url, excerpt,
           mentioned_at, last_author_id, last_author_name, last_activity_at,
           resolved, resolved_at, created_at, updated_at)
         VALUES ('chat', ?, NULL, ?, ?, ?, '', ?, NULL, ?, ?, 0, NULL, ?, ?)`
      ).run(p.id, p.bucket_name, `Ping from ${pinger}`, p.app_url, lastActivity, pinger, lastActivity, now, now);
    }
  }

  // A chat thread drops out of `unreads` once Eddy has opened/read it in Basecamp.
  const openChats = db.prepare("SELECT recording_id FROM needs_reply WHERE kind = 'chat' AND resolved = 0").all() as {
    recording_id: number;
  }[];
  const resolve = db.prepare("UPDATE needs_reply SET resolved = 1, resolved_at = ? WHERE recording_id = ?");
  for (const row of openChats) {
    if (!seenIds.has(row.recording_id)) resolve.run(now, row.recording_id);
  }
}
