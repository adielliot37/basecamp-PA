const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";

export type Priority = "high" | "med" | "low";

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
  ask: string | null;
  draft_reply: string | null;
  ai_priority: Priority | null;
}

export interface WaitingOnItem {
  recording_id: number;
  project_id: number | null;
  project_name: string;
  title: string;
  app_url: string;
  excerpt: string;
  last_activity_at: number | null;
}

export interface TaskItem {
  todo_id: number;
  project_id: number | null;
  project_name: string;
  title: string;
  app_url: string;
  due_on: string | null;
  flag: "overdue" | "today" | "ok";
  priority: Priority;
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

export interface PersonalTask {
  id: number;
  basecamp_link: string;
  note: string;
  due_date: string | null;
  created_at: number;
  completed_at: number | null;
  completion_note: string | null;
  deleted_at: number | null;
}

export interface PersonalBoard {
  active: PersonalTask[];
  completed: PersonalTask[];
  bin: PersonalTask[];
}

export type ReportAutomationStatus = "pending" | "executed" | "failed" | "cancelled";

export interface ReportAutomationEvent {
  remote_id: number;
  comment_text: string;
  scheduled_at: string | null;
  scheduled_at_ist: string | null;
  status: ReportAutomationStatus;
  error_msg: string | null;
  basecamp_comment_id: string | null;
  updated_at: number;
}

export interface ReportAutomationInfo {
  today: ReportAutomationEvent | null;
  history: ReportAutomationEvent[];
}

const TOKEN_KEY = "cockpit_session_token";

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export function hasToken(): boolean {
  return typeof window !== "undefined" && !!window.localStorage.getItem(TOKEN_KEY);
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

async function authFetch(path: string, init: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });

  const rolled = res.headers.get("X-Session-Token");
  if (rolled) setToken(rolled);

  if (res.status === 401) {
    clearToken();
    unauthorizedHandler?.();
  }
  return res;
}

async function get<T>(path: string): Promise<T> {
  const res = await authFetch(path, { method: "GET" });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const authApi = {
  status: async (): Promise<{ required: boolean }> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/status`, { cache: "no-store" });
      if (!res.ok) return { required: false };
      return (await res.json()) as { required: boolean };
    } catch {
      return { required: false };
    }
  },
  login: async (password: string): Promise<{ expiresAt: number }> => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error("Invalid password");
    const data = (await res.json()) as { token: string; expiresAt: number };
    setToken(data.token);
    return { expiresAt: data.expiresAt };
  }
};

export const api = {
  needsReply: () => get<NeedsReplyItem[]>("/api/needs-reply"),
  waitingOn: () => get<WaitingOnItem[]>("/api/waiting-on"),
  tasks: () => get<TaskItem[]>("/api/tasks"),
  other: () => get<OtherDigest>("/api/other"),
  reportsDue: () => get<ReportsDueInfo>("/api/reports-due"),
  status: () => get<StatusInfo>("/api/status"),
  personalBoard: () => get<PersonalBoard>("/api/personal-tasks"),
  createPersonalTask: (input: { basecamp_link: string; note: string; due_date?: string | null }) =>
    send<PersonalTask>("/api/personal-tasks", "POST", input),
  completePersonalTask: (id: number, completion_note?: string) =>
    send<PersonalTask>(`/api/personal-tasks/${id}/complete`, "PATCH", { completion_note }),
  uncompletePersonalTask: (id: number) => send<PersonalTask>(`/api/personal-tasks/${id}/uncomplete`, "PATCH", {}),
  deletePersonalTask: (id: number) => send<{ ok: true }>(`/api/personal-tasks/${id}/delete`, "PATCH", {}),
  restorePersonalTask: (id: number) => send<PersonalTask>(`/api/personal-tasks/${id}/restore`, "PATCH", {}),
  purgePersonalTask: (id: number) => send<{ ok: true }>(`/api/personal-tasks/${id}`, "DELETE"),
  emptyPersonalBin: () => send<{ ok: true }>("/api/personal-tasks/bin", "DELETE"),
  reportAutomation: () => get<ReportAutomationInfo>("/api/report-automation"),
};
