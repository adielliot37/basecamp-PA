import type { FastifyInstance } from "fastify";
import { db } from "../db.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/status", async () => {
    return db.prepare("SELECT last_run_at, last_ok_at, last_error FROM poller_state WHERE id = 1").get();
  });

  app.get("/api/needs-reply", async () => {
    return db
      .prepare(
        `SELECT kind, recording_id, project_id, project_name, title, app_url, excerpt,
                mentioned_at, last_author_id, last_author_name, last_activity_at
         FROM needs_reply
         WHERE resolved = 0
         ORDER BY COALESCE(last_activity_at, mentioned_at) DESC`
      )
      .all();
  });

  app.get("/api/tasks", async () => {
    return db
      .prepare(
        `SELECT todo_id, project_id, project_name, title, app_url, due_on
         FROM assignment_cache
         ORDER BY (due_on IS NULL), due_on ASC`
      )
      .all();
  });

  app.get("/api/other", async () => {
    const all = db
      .prepare(
        `SELECT id, type, title, project_name, app_url, created_at_bc
         FROM other_notification
         ORDER BY created_at_bc DESC`
      )
      .all() as Array<{
      id: number;
      type: string;
      title: string;
      project_name: string;
      app_url: string;
      created_at_bc: number;
    }>;

    const digestRow = db
      .prepare("SELECT highlights_json, routine_summary FROM digest WHERE id = 1")
      .get() as { highlights_json: string; routine_summary: string } | undefined;

    const byId = new Map(all.map((n) => [n.id, n]));
    const highlightRefs = digestRow ? (JSON.parse(digestRow.highlights_json) as { id: number; reason: string }[]) : [];
    const highlights = highlightRefs
      .map((h) => {
        const item = byId.get(h.id);
        return item ? { ...item, reason: h.reason } : null;
      })
      .filter(Boolean);

    return {
      total: all.length,
      highlights,
      routineSummary: digestRow?.routine_summary ?? null,
      all
    };
  });

  app.get("/api/reports-due", async () => {
    return db
      .prepare("SELECT todo_id, app_url, posted_today, last_posted_at, checked_at FROM report_status WHERE id = 1")
      .get();
  });

  app.get("/api/watched-projects", async () => {
    return db
      .prepare("SELECT id, name, source, last_seen_at FROM watched_project ORDER BY last_seen_at DESC")
      .all();
  });
}
