import { bcFetch } from "../basecamp/client.js";
import { config } from "../config.js";
import { db } from "../db.js";
import { mentionsMe } from "../basecamp/mention.js";
import type { BcComment } from "../basecamp/types.js";

interface Reading {
  id: number;
  type: string;
  title: string;
  content_excerpt?: string;
  app_url: string;
  bucket_name: string;
  created_at: string;
}

interface ReadingsResponse {
  unreads: Reading[];
}

/** Parses the container recording id (todo/message) out of a Basecamp app_url. */
function parseContainerId(appUrl: string): number | null {
  const match = appUrl.match(/\/(?:todos|messages|documents|uploads|todolists|card_tables\/cards)\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function upsertNeedsReply(row: {
  recordingId: number;
  projectId: number | null;
  projectName: string;
  title: string;
  appUrl: string;
  excerpt: string;
  mentionedAt: number;
  lastAuthorId: number | null;
  lastAuthorName: string | null;
  lastActivityAt: number | null;
  resolved: boolean;
}) {
  const now = Date.now();
  const existing = db
    .prepare("SELECT recording_id FROM needs_reply WHERE recording_id = ?")
    .get(row.recordingId);

  if (existing) {
    db.prepare(
      `UPDATE needs_reply
       SET project_id = ?, project_name = ?, title = ?, app_url = ?, excerpt = ?,
           last_author_id = ?, last_author_name = ?, last_activity_at = ?,
           resolved = ?, resolved_at = CASE WHEN ? = 1 AND resolved = 0 THEN ? ELSE resolved_at END,
           updated_at = ?
       WHERE recording_id = ?`
    ).run(
      row.projectId,
      row.projectName,
      row.title,
      row.appUrl,
      row.excerpt,
      row.lastAuthorId,
      row.lastAuthorName,
      row.lastActivityAt,
      row.resolved ? 1 : 0,
      row.resolved ? 1 : 0,
      now,
      now,
      row.recordingId
    );
  } else {
    db.prepare(
      `INSERT INTO needs_reply
        (recording_id, project_id, project_name, title, app_url, excerpt,
         mentioned_at, last_author_id, last_author_name, last_activity_at,
         resolved, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.recordingId,
      row.projectId,
      row.projectName,
      row.title,
      row.appUrl,
      row.excerpt,
      row.mentionedAt,
      row.lastAuthorId,
      row.lastAuthorName,
      row.lastActivityAt,
      row.resolved ? 1 : 0,
      row.resolved ? now : null,
      now,
      now
    );
  }
}

/** Re-checks one thread's latest comment and updates resolved status. */
async function refreshThread(recordingId: number, fallback: {
  projectId: number | null;
  projectName: string;
  title: string;
  appUrl: string;
  excerpt: string;
  mentionedAt: number;
}) {
  let comments: BcComment[] = [];
  try {
    comments = await bcFetch<BcComment[]>(`/recordings/${recordingId}/comments.json`);
  } catch {
    // Thread may have been trashed/archived; leave existing row as-is.
    return;
  }

  const last = comments.at(-1);
  const resolvedByLastComment = last ? last.creator.id === config.basecamp.myPersonId : false;

  // If nobody has mentioned me in the whole visible thread anymore (e.g. comment
  // deleted), don't resurrect a stale row — but still record latest activity.
  const stillMentioned = comments.some((c) => mentionsMe(c.content)) || !comments.length;

  upsertNeedsReply({
    recordingId,
    projectId: fallback.projectId,
    projectName: fallback.projectName,
    title: fallback.title,
    appUrl: fallback.appUrl,
    excerpt: fallback.excerpt,
    mentionedAt: fallback.mentionedAt,
    lastAuthorId: last?.creator.id ?? null,
    lastAuthorName: last?.creator.name ?? null,
    lastActivityAt: last ? Date.parse(last.created_at) : null,
    resolved: resolvedByLastComment || !stillMentioned
  });
}

/** Pass 1: pull fresh Mention notifications and create/refresh their rows. */
async function discoverFromMentions() {
  const { unreads } = await bcFetch<ReadingsResponse>("/my/readings.json");
  const mentions = unreads.filter((n) => n.type === "Mention");

  for (const note of mentions) {
    const containerId = parseContainerId(note.app_url);
    if (!containerId) continue;

    const projectMatch = note.app_url.match(/\/buckets\/(\d+)\//);
    const projectId = projectMatch ? Number(projectMatch[1]) : null;

    await refreshThread(containerId, {
      projectId,
      projectName: note.bucket_name,
      title: note.title,
      appUrl: note.app_url,
      excerpt: note.content_excerpt ?? "",
      mentionedAt: Date.parse(note.created_at)
    });
  }
}

/** Pass 2: re-check every currently-open row so replies clear it even without a fresh notification. */
async function reconcileOpenThreads() {
  const open = db
    .prepare("SELECT recording_id, project_id, project_name, title, app_url, excerpt, mentioned_at FROM needs_reply WHERE resolved = 0")
    .all() as Array<{
    recording_id: number;
    project_id: number | null;
    project_name: string;
    title: string;
    app_url: string;
    excerpt: string;
    mentioned_at: number;
  }>;

  for (const row of open) {
    await refreshThread(row.recording_id, {
      projectId: row.project_id,
      projectName: row.project_name,
      title: row.title,
      appUrl: row.app_url,
      excerpt: row.excerpt,
      mentionedAt: row.mentioned_at
    });
  }
}

export async function runNeedsReplyPass() {
  await discoverFromMentions();
  await reconcileOpenThreads();
}
