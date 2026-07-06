import { bcFetch } from "../basecamp/client.js";
import { config } from "../config.js";
import { db } from "../db.js";

interface Reading {
  app_url: string;
  bucket_name: string;
}
interface ReadingsResponse {
  unreads: Reading[];
}
interface AssignmentTodo {
  bucket: { id: number; name: string };
}
interface AssignmentsResponse {
  priorities: AssignmentTodo[];
  assigned?: AssignmentTodo[];
}

function upsertWatched(id: number, name: string) {
  const now = Date.now();
  const existing = db.prepare("SELECT id FROM watched_project WHERE id = ?").get(id);
  if (existing) {
    db.prepare("UPDATE watched_project SET name = ?, last_seen_at = ? WHERE id = ?").run(name, now, id);
  } else {
    db.prepare(
      "INSERT INTO watched_project (id, name, source, last_seen_at, created_at) VALUES (?, ?, 'auto', ?, ?)"
    ).run(id, name, now, now);
  }
}

export async function runWatchSetDiscovery() {
  const { unreads } = await bcFetch<ReadingsResponse>("/my/readings.json");
  for (const note of unreads) {
    const match = note.app_url.match(/\/buckets\/(\d+)\//);
    if (match) upsertWatched(Number(match[1]), note.bucket_name);
  }

  const assignments = await bcFetch<AssignmentsResponse>("/my/assignments.json");
  const allTodos = [...(assignments.priorities ?? []), ...(assignments.assigned ?? [])];
  for (const todo of allTodos) {
    if (todo.bucket) upsertWatched(todo.bucket.id, todo.bucket.name);
  }

  // Age out auto-discovered projects with no activity in a while; manual pins never expire.
  const cutoff = Date.now() - config.watchSetMaxAgeDays * 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM watched_project WHERE source = 'auto' AND last_seen_at < ?").run(cutoff);
}
