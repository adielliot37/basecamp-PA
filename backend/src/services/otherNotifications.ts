import { bcFetch } from "../basecamp/client.js";
import { db } from "../db.js";

interface Reading {
  id: number;
  type: string;
  title: string;
  app_url: string;
  bucket_name: string;
  updated_at: string;
}
interface ReadingsResponse {
  unreads: Reading[];
}

/**
 * Mirrors currently-unread, non-Mention notifications (Chat, Comment, Reminder,
 * Assignment, Completion, Event, Message, BoostReport). Unlike needs_reply, this
 * is a straightforward unread mirror, not a persist-past-read log — Basecamp's own
 * "mark read" clears it here too. Good enough for a catch-all glance panel in v1.
 *
 * Recency is sourced from `updated_at`, not `created_at` — Basecamp reuses one
 * notification record per thread and just bumps `updated_at` on fresh activity,
 * so `created_at` can be months stale (found via a real bug: a same-day chat
 * ping sorted as "117d ago" because its thread's record was created in March).
 */
export async function runOtherNotificationsSync() {
  const { unreads } = await bcFetch<ReadingsResponse>("/my/readings.json");
  const others = unreads.filter((n) => n.type !== "Mention");
  const now = Date.now();
  const seenIds = new Set<number>();

  const upsert = db.prepare(
    `INSERT INTO other_notification (id, type, title, project_name, app_url, created_at_bc, updated_at)
     VALUES (@id, @type, @title, @project_name, @app_url, @created_at_bc, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, project_name = excluded.project_name,
       created_at_bc = excluded.created_at_bc, updated_at = excluded.updated_at`
  );

  for (const n of others) {
    seenIds.add(n.id);
    upsert.run({
      id: n.id,
      type: n.type,
      title: n.title,
      project_name: n.bucket_name,
      app_url: n.app_url,
      created_at_bc: Date.parse(n.updated_at),
      updated_at: now
    });
  }

  const existing = db.prepare("SELECT id FROM other_notification").all() as { id: number }[];
  const del = db.prepare("DELETE FROM other_notification WHERE id = ?");
  for (const row of existing) {
    if (!seenIds.has(row.id)) del.run(row.id);
  }
}
