import { bcFetch } from "../basecamp/client.js";
import { db } from "../db.js";

interface AssignmentTodo {
  id: number;
  content: string;
  due_on: string | null;
  completed: boolean;
  bucket: { id: number; name: string };
  app_url: string;
  parent?: { title: string };
  assignees: { name: string }[];
}
interface AssignmentsResponse {
  priorities: AssignmentTodo[];
  assigned?: AssignmentTodo[];
}

/**
 * Recurring per-person todos (Team Daily Report, Weekly Task Tracker, Check-IN &
 * Check-OUT, ...) get created with the assignee's bare name as content — "Eddy"
 * tells you nothing. The parent todolist's title is what actually explains the ask.
 */
function displayTitle(t: AssignmentTodo): string {
  const content = t.content.trim();
  const isBareName = t.assignees.some((a) => a.name.trim() === content);
  if (isBareName && t.parent?.title) return t.parent.title;
  return content;
}

export async function runAssignmentsSync() {
  const data = await bcFetch<AssignmentsResponse>("/my/assignments.json");
  const todos = [...(data.priorities ?? []), ...(data.assigned ?? [])].filter((t) => !t.completed);

  const now = Date.now();
  const seenIds = new Set<number>();

  const upsert = db.prepare(
    `INSERT INTO assignment_cache (todo_id, project_id, project_name, title, app_url, due_on, created_at, updated_at)
     VALUES (@todo_id, @project_id, @project_name, @title, @app_url, @due_on, @created_at, @updated_at)
     ON CONFLICT(todo_id) DO UPDATE SET
       project_id = excluded.project_id, project_name = excluded.project_name,
       title = excluded.title, app_url = excluded.app_url, due_on = excluded.due_on,
       updated_at = excluded.updated_at`
  );

  for (const t of todos) {
    seenIds.add(t.id);
    upsert.run({
      todo_id: t.id,
      project_id: t.bucket?.id ?? null,
      project_name: t.bucket?.name ?? "",
      title: displayTitle(t),
      app_url: t.app_url,
      due_on: t.due_on,
      created_at: now,
      updated_at: now
    });
  }

  // Drop rows for todos that are no longer in the open-assignments list (completed/reassigned).
  const existing = db.prepare("SELECT todo_id FROM assignment_cache").all() as { todo_id: number }[];
  const del = db.prepare("DELETE FROM assignment_cache WHERE todo_id = ?");
  for (const row of existing) {
    if (!seenIds.has(row.todo_id)) del.run(row.todo_id);
  }
}
