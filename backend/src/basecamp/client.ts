import { config } from "../config.js";
import { db } from "../db.js";

interface TokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function getTokenRow(): TokenRow {
  return db
    .prepare("SELECT access_token, refresh_token, expires_at FROM oauth_token WHERE id = 1")
    .get() as TokenRow;
}

function saveToken(accessToken: string, refreshToken: string, expiresInSeconds: number) {
  db.prepare(
    `UPDATE oauth_token SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ? WHERE id = 1`
  ).run(accessToken, refreshToken, Date.now() + expiresInSeconds * 1000, Date.now());
}

async function refreshAccessToken(): Promise<string> {
  const { refresh_token } = getTokenRow();
  const url = new URL("https://launchpad.37signals.com/authorization/token");
  url.searchParams.set("type", "refresh");
  url.searchParams.set("client_id", config.basecamp.clientId);
  url.searchParams.set("client_secret", config.basecamp.clientSecret);
  url.searchParams.set("refresh_token", refresh_token);

  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Basecamp token refresh failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  saveToken(json.access_token, json.refresh_token ?? refresh_token, json.expires_in);
  return json.access_token;
}

async function getValidAccessToken(): Promise<string> {
  const row = getTokenRow();
  // Refresh proactively if we're within 10 minutes of expiry (or never validated yet).
  if (row.expires_at > Date.now() + 10 * 60 * 1000) {
    return row.access_token;
  }
  return refreshAccessToken();
}

const BASE = () => `https://3.basecampapi.com/${config.basecamp.accountId}`;

export async function bcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const doFetch = async (token: string) =>
    fetch(`${BASE()}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "User-Agent": config.basecamp.userAgent,
        "Content-Type": "application/json"
      }
    });

  let token = await getValidAccessToken();
  let res: Response = await doFetch(token);

  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await doFetch(token);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Basecamp API ${path} failed: ${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Paginates via the Link: rel="next" header, stopping as soon as `stopAfterPage`
 * returns true for a page (checked after collecting it) or `maxPages` is hit.
 * For endpoints sorted newest-first, use this to bound a scan by recency
 * instead of walking the entire history.
 */
export async function bcFetchPagesUntil<T>(
  path: string,
  stopAfterPage: (page: T[]) => boolean,
  maxPages = 10
): Promise<T[]> {
  const results: T[] = [];
  let token = await getValidAccessToken();
  let url: string | null = `${BASE()}${path}`;
  let pageCount = 0;

  while (url && pageCount < maxPages) {
    let res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": config.basecamp.userAgent
      }
    });
    if (res.status === 401) {
      token = await refreshAccessToken();
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": config.basecamp.userAgent
        }
      });
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Basecamp API ${url} failed: ${res.status} ${body}`);
    }
    const page = (await res.json()) as T[];
    results.push(...page);
    pageCount += 1;

    if (stopAfterPage(page)) break;

    const link: string | null = res.headers.get("Link");
    const match: RegExpMatchArray | null | undefined = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }

  return results;
}

/** Paginates via the Link: rel="next" header, collecting every page into one array. */
export async function bcFetchAllPages<T>(path: string): Promise<T[]> {
  const results: T[] = [];
  let token = await getValidAccessToken();
  let url: string | null = `${BASE()}${path}`;

  while (url) {
    let res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": config.basecamp.userAgent
      }
    });
    if (res.status === 401) {
      token = await refreshAccessToken();
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": config.basecamp.userAgent
        }
      });
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Basecamp API ${url} failed: ${res.status} ${body}`);
    }
    const page = (await res.json()) as T[];
    results.push(...page);

    const link: string | null = res.headers.get("Link");
    const match: RegExpMatchArray | null | undefined = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = match ? match[1] : null;
  }

  return results;
}
