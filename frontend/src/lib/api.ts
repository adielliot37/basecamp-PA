const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

export interface NeedsReplyItem {
  kind: "mention" | "chat";
  recording_id: number;
  project_id: number | null;
  project_name: string;
  title: string;
  app_url: string;
  excerpt: string;
  mentioned_at: number;
  last_author_id: number | null;
  last_author_name: string | null;
  last_activity_at: number | null;
}

export interface TaskItem {
  todo_id: number;
  project_id: number | null;
  project_name: string;
  title: string;
  app_url: string;
  due_on: string | null;
}

export interface OtherNotificationItem {
  id: number;
  type: string;
  title: string;
  project_name: string;
  app_url: string;
  created_at_bc: number;
}

export interface OtherHighlight extends OtherNotificationItem {
  reason: string;
}

export interface OtherDigest {
  total: number;
  highlights: OtherHighlight[];
  routineSummary: string | null;
  all: OtherNotificationItem[];
}

export interface ReportsDueInfo {
  todo_id: number | null;
  app_url: string | null;
  posted_today: number;
  last_posted_at: number | null;
  checked_at: number | null;
}

export interface StatusInfo {
  last_run_at: number | null;
  last_ok_at: number | null;
  last_error: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  needsReply: () => get<NeedsReplyItem[]>("/api/needs-reply"),
  tasks: () => get<TaskItem[]>("/api/tasks"),
  other: () => get<OtherDigest>("/api/other"),
  reportsDue: () => get<ReportsDueInfo>("/api/reports-due"),
  status: () => get<StatusInfo>("/api/status"),
};
