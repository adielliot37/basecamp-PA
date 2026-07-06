import { bcFetch, bcFetchPagesUntil } from "../basecamp/client.js";
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
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
  lastCommentText: string | null;
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
           last_author_id = ?, last_author_name = ?, last_activity_at = ?, last_comment_text = ?,
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
      row.lastCommentText,
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
         mentioned_at, last_author_id, last_author_name, last_activity_at, last_comment_text,
         resolved, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      row.lastCommentText,
      row.resolved ? 1 : 0,
      row.resolved ? now : null,
      now,
      now
    );
  }
}

/**
 * A completed (or voided/checked-off) todo needs no reply regardless of who
 * commented last — found via a real false positive: a todo titled
 * "[VOIDED] STRIKE..." with completed:true kept showing as open because
 * resolution only ever looked at comment order, never task status.
 */
async function isContainerCompleted(projectId: number | null, recordingId: number): Promise<boolean> {
  if (!projectId) return false;
  try {
    const todo = await bcFetch<{ completed?: boolean }>(`/buckets/${projectId}/todos/${recordingId}.json`);
    return todo.completed === true;
  } catch {
    return false; // not a todo (e.g. a Message/Document) or inaccessible — not a completed-todo case
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
  const resolved = resolvedByLastComment || (await isContainerCompleted(fallback.projectId, recordingId));

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
    lastCommentText: last ? stripHtml(last.content) : null,
    resolved
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

const SCAN_RECENCY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Pass 1b: scan account-wide recent comments directly for the mention marker,
 * independent of Basecamp's "unread" flag or the auto-discovered watch-set.
 *
 * Verified 2026-07-06, two real gaps found in production:
 * 1. The unread flag is NOT a reliable discovery gate — it flips in real time
 *    (e.g. the instant Eddy opens the thread himself to check something), so
 *    a mention can be read-and-gone before a 75s poll ever sees it unread,
 *    even though he never actually replied.
 * 2. The watch-set (from notifications + assignments) is incomplete — a
 *    project with no recent unread/assignment activity never enters it, so a
 *    per-watched-project scan silently misses mentions there too.
 *
 * Comment content itself is permanent and read-state-independent, and this
 * endpoint is account-wide (not scoped to the watch-set), sorted newest-first
 * — paginate only as far back as SCAN_RECENCY_MS, since account-wide activity
 * across ~350 projects means "all history" would be far too much to walk
 * every poll. discoverFromMentions (unreads) stays on as a faster, cheaper
 * secondary signal for the common case where it isn't racing a read.
 */
async function scanAccountWideComments() {
  const cutoff = Date.now() - SCAN_RECENCY_MS;

  // Stop only once an entire page is past the cutoff — a single out-of-order
  // page (this is an aggregation across ~350 projects, not one clean table)
  // shouldn't truncate the scan early and silently drop a recent mention.
  const comments = await bcFetchPagesUntil<BcComment>(
    "/projects/recordings.json?type=Comment&sort=updated_at&direction=desc",
    (page) => page.length > 0 && page.every((c) => Date.parse(c.updated_at) < cutoff),
    20
  );

  const seenParents = new Set<number>();

  for (const comment of comments) {
    if (Date.parse(comment.updated_at) < cutoff) continue;
    if (!comment.parent || !comment.bucket) continue;

    // Two independent reasons a thread is worth tracking here: someone
    // mentioned Eddy in it, or Eddy himself just commented (making it a
    // "waiting on a reply" candidate — his own comment naturally won't
    // mention himself, so this can't be folded into the check above).
    const isRelevant = mentionsMe(comment.content) || comment.creator.id === config.basecamp.myPersonId;
    if (!isRelevant || seenParents.has(comment.parent.id)) continue;
    seenParents.add(comment.parent.id);

    await refreshThread(comment.parent.id, {
      projectId: comment.bucket.id,
      projectName: comment.bucket.name,
      title: comment.parent.title ?? comment.title ?? "Untitled",
      appUrl: comment.parent.app_url,
      excerpt: "",
      mentionedAt: Date.parse(comment.created_at)
    });
  }

}

const WATCH_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

/**
 * Pass 2: re-check every recently-active mention thread, not just unresolved
 * ones — including threads where Eddy spoke last ("waiting on a reply"). If
 * someone else replies after him, this is what flips it back to unresolved.
 * Bounded to a recency window so it doesn't re-scan Basecamp's entire history
 * forever.
 */
async function reconcileOpenThreads() {
  const cutoff = Date.now() - WATCH_WINDOW_MS;
  const open = db
    .prepare(
      `SELECT recording_id, project_id, project_name, title, app_url, excerpt, mentioned_at
       FROM needs_reply
       WHERE kind = 'mention' AND COALESCE(last_activity_at, mentioned_at) >= ?`
    )
    .all(cutoff) as Array<{
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
  await scanAccountWideComments();
  await reconcileOpenThreads();
}
