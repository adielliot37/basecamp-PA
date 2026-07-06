import { bcFetch, bcFetchAllPages } from "../basecamp/client.js";
import { config } from "../config.js";
import { db } from "../db.js";
import type { BcComment } from "../basecamp/types.js";

interface Group {
  id: number;
}
interface Todo {
  id: number;
  app_url: string;
  assignees: { id: number }[];
}

function todayInKolkata(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date()); // "YYYY-MM-DD"
}

function dateInKolkata(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

export async function runReportsDueCheck() {
  const { dailyReportBucketId: bucket, dailyReportTodolistId: todolist, myPersonId } = config.basecamp;

  const groups = await bcFetch<Group[]>(`/buckets/${bucket}/todolists/${todolist}/groups.json`);
  const currentGroup = groups[0];
  if (!currentGroup) throw new Error("Team Daily Report: no active monthly group found");

  const todos = await bcFetchAllPages<Todo>(`/buckets/${bucket}/todolists/${currentGroup.id}/todos.json`);
  const myTodo = todos.find((t) => t.assignees.some((a) => a.id === myPersonId));
  if (!myTodo) throw new Error("Team Daily Report: no todo assigned to me in the current month's group");

  const comments = await bcFetch<BcComment[]>(`/recordings/${myTodo.id}/comments.json`);
  const today = todayInKolkata();
  const myCommentsToday = comments.filter(
    (c) => c.creator.id === myPersonId && dateInKolkata(c.created_at) === today
  );
  const lastMineToday = myCommentsToday.at(-1);

  db.prepare(
    `INSERT INTO report_status (id, todo_id, app_url, posted_today, last_posted_at, checked_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       todo_id = excluded.todo_id, app_url = excluded.app_url,
       posted_today = excluded.posted_today, last_posted_at = excluded.last_posted_at,
       checked_at = excluded.checked_at`
  ).run(
    myTodo.id,
    myTodo.app_url,
    lastMineToday ? 1 : 0,
    lastMineToday ? Date.parse(lastMineToday.created_at) : null,
    Date.now()
  );
}
