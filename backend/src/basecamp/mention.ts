import { config } from "../config.js";

// Verified 2026-07-06 against a real comment: mentions embed
// <bc-attachment sgid="..." content='...gid="gid://bc3/Person/<id>"...'>
const MENTION_MARKER = `gid=\\"gid://bc3/Person/${config.basecamp.myPersonId}\\"`;
const MENTION_MARKER_PLAIN = `gid="gid://bc3/Person/${config.basecamp.myPersonId}"`;

export function mentionsMe(html: string): boolean {
  return html.includes(MENTION_MARKER_PLAIN) || html.includes(MENTION_MARKER);
}
