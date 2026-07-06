import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  basecamp: {
    clientId: required("BC_CLIENT_ID"),
    clientSecret: required("BC_CLIENT_SECRET"),
    redirectUri: required("BC_REDIRECT_URI"),
    accountId: process.env.BC_ACCOUNT_ID ?? "3526928",
    accessToken: process.env.BC_ACCESS_TOKEN ?? "",
    refreshToken: required("BC_REFRESH_TOKEN"),
    // Eddy's Person record within account 3526928 (NOT the Launchpad identity id).
    // Resolved via GET /my/profile.json, verified against a real mention on 2026-07-06.
    myPersonId: 50586024,
    userAgent: "BasecampCockpit (aditya311001rj@gmail.com)",
    // "Team Daily Report" todolist in OPS: HR PEOPLE. Stable id — verified 2026-07-06;
    // it nests one auto-managed group per month (found via groups.json), which in turn
    // holds one todo per person, commented on daily with the 7-point EOS report.
    dailyReportBucketId: 11204075,
    dailyReportTodolistId: 6602397485
  },
  port: Number(process.env.PORT ?? 4100),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 75_000),
  watchSetMaxAgeDays: Number(process.env.WATCHSET_MAX_AGE_DAYS ?? 21),
  dbPath: process.env.DB_PATH ?? "./data/cockpit.sqlite",
  apiBearer: process.env.API_BEARER ?? ""
};
