import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { config } from "../config.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/api/status", async () => {
    return db.prepare("SELECT last_run_at, last_ok_at, last_error FROM poller_state WHERE id = 1").get();
  });

  app.get("/api/needs-reply", async () => {
    return db
      .prepare(
        `SELECT kind, recording_id, project_id, project_name, title, app_url, excerpt,
                mentioned_at, last_author_id, last_author_name, last_activity_at,
                ask, draft_reply, ai_priority
         FROM needs_reply
         WHERE resolved = 0
         ORDER BY COALESCE(last_activity_at, mentioned_at) DESC`
      )
      .all();
  });

  app.get("/api/waiting-on", async () => {
    return db
      .prepare(
        `SELECT recording_id, project_id, project_name, title, app_url, excerpt, last_activity_at
         FROM needs_reply
         WHERE kind = 'mention' AND resolved = 1 AND last_author_id = ?
         ORDER BY last_activity_at ASC`
      )
      .all(config.basecamp.myPersonId);
  });

  app.get("/api/tasks", async () => {
    const rows = db
      .prepare(
        `SELECT todo_id, project_id, project_name, title, app_url, due_on
         FROM assignment_cache
         ORDER BY (due_on IS NULL), due_on ASC`
      )
      .all() as Array<{
      todo_id: number;
      project_id: number | null;
      project_name: string;
      title: string;
      app_url: string;
      due_on: string | null;
    }>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rows.map((t) => {
      let flag: "overdue" | "today" | "ok" = "ok";
      let priority: "high" | "med" | "low" = "low";
      if (t.due_on) {
        const diffDays = Math.round((new Date(t.due_on + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
        if (diffDays < 0) {
          flag = "overdue";
          priority = "high";
        } else if (diffDays === 0) {
          flag = "today";
          priority = "high";
        } else if (diffDays <= 2) {
          priority = "med";
        }
      }
      return { ...t, flag, priority };
    });
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

  app.get("/api/personal-tasks", async () => {
    const rows = db
      .prepare("SELECT * FROM personal_task ORDER BY created_at DESC")
      .all() as PersonalTaskRow[];
    return {
      active: rows.filter((t) => !t.deleted_at && !t.completed_at),
      completed: rows.filter((t) => !t.deleted_at && t.completed_at),
      bin: rows.filter((t) => t.deleted_at)
    };
  });

  app.post("/api/personal-tasks", async (req, reply) => {
    const body = req.body as { basecamp_link?: string; note?: string; due_date?: string | null };
    const basecampLink = body.basecamp_link?.trim();
    const note = body.note?.trim();
    if (!basecampLink || !note) {
      return reply.code(400).send({ error: "basecamp_link and note are required" });
    }
    const info = db
      .prepare(`INSERT INTO personal_task (basecamp_link, note, due_date, created_at) VALUES (?, ?, ?, ?)`)
      .run(basecampLink, note, body.due_date || null, Date.now());
    return db.prepare("SELECT * FROM personal_task WHERE id = ?").get(info.lastInsertRowid);
  });

  app.patch("/api/personal-tasks/:id/complete", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as { completion_note?: string | null };
    db.prepare(`UPDATE personal_task SET completed_at = ?, completion_note = ? WHERE id = ?`).run(
      Date.now(),
      body.completion_note?.trim() || null,
      id
    );
    return db.prepare("SELECT * FROM personal_task WHERE id = ?").get(id);
  });

  app.patch("/api/personal-tasks/:id/uncomplete", async (req) => {
    const { id } = req.params as { id: string };
    db.prepare(`UPDATE personal_task SET completed_at = NULL, completion_note = NULL WHERE id = ?`).run(id);
    return db.prepare("SELECT * FROM personal_task WHERE id = ?").get(id);
  });

  app.patch("/api/personal-tasks/:id/delete", async (req) => {
    const { id } = req.params as { id: string };
    db.prepare(`UPDATE personal_task SET deleted_at = ? WHERE id = ?`).run(Date.now(), id);
    return { ok: true };
  });

  app.patch("/api/personal-tasks/:id/restore", async (req) => {
    const { id } = req.params as { id: string };
    db.prepare(`UPDATE personal_task SET deleted_at = NULL WHERE id = ?`).run(id);
    return db.prepare("SELECT * FROM personal_task WHERE id = ?").get(id);
  });

  app.delete("/api/personal-tasks/bin", async () => {
    db.prepare(`DELETE FROM personal_task WHERE deleted_at IS NOT NULL`).run();
    return { ok: true };
  });

  app.delete("/api/personal-tasks/:id", async (req) => {
    const { id } = req.params as { id: string };
    db.prepare(`DELETE FROM personal_task WHERE id = ?`).run(id);
    return { ok: true };
  });

  app.post("/api/report-automation/event", async (req, reply) => {
    if (
      !config.reportAutomationSecret ||
      req.headers.authorization !== `Bearer ${config.reportAutomationSecret}`
    ) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const body = req.body as {
      remote_id?: number;
      status?: string;
      comment_text?: string;
      scheduled_at?: string | null;
      scheduled_at_ist?: string | null;
      error_msg?: string | null;
      basecamp_comment_id?: string | null;
    };
    if (!body.remote_id || !body.status || !body.comment_text) {
      return reply.code(400).send({ error: "remote_id, status, and comment_text are required" });
    }
    db.prepare(
      `INSERT INTO report_automation
         (remote_id, comment_text, scheduled_at, scheduled_at_ist, status, error_msg, basecamp_comment_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(remote_id) DO UPDATE SET
         comment_text = excluded.comment_text,
         scheduled_at = excluded.scheduled_at,
         scheduled_at_ist = excluded.scheduled_at_ist,
         status = excluded.status,
         error_msg = excluded.error_msg,
         basecamp_comment_id = excluded.basecamp_comment_id,
         updated_at = excluded.updated_at`
    ).run(
      body.remote_id,
      body.comment_text,
      body.scheduled_at ?? null,
      body.scheduled_at_ist ?? null,
      body.status,
      body.error_msg ?? null,
      body.basecamp_comment_id ?? null,
      Date.now()
    );
    return { ok: true };
  });

  app.get("/api/report-automation", async () => {
    const rows = db
      .prepare("SELECT * FROM report_automation ORDER BY scheduled_at DESC LIMIT 30")
      .all() as ReportAutomationRow[];

    const todayIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = rows.find((r) => r.scheduled_at_ist?.slice(0, 10) === todayIst) ?? null;

    return { today, history: rows };
  });
}

interface ReportAutomationRow {
  remote_id: number;
  comment_text: string;
  scheduled_at: string | null;
  scheduled_at_ist: string | null;
  status: string;
  error_msg: string | null;
  basecamp_comment_id: string | null;
  updated_at: number;
}

interface PersonalTaskRow {
  id: number;
  basecamp_link: string;
  note: string;
  due_date: string | null;
  created_at: number;
  completed_at: number | null;
  completion_note: string | null;
  deleted_at: number | null;
}
