import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { seedOauthTokenIfEmpty } from "./db.js";
import { registerRoutes } from "./routes/api.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { issueToken, verifyToken } from "./auth/session.js";
import { startPoller } from "./poller.js";

seedOauthTokenIfEmpty();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, exposedHeaders: ["X-Session-Token"] });

const UNAUTHENTICATED_PATHS = [
  "/api/auth/login",
  "/api/auth/status",
  "/api/status",
  "/api/report-automation/event"
];

app.addHook("onRequest", async (req, reply) => {
  if (!config.authPassword) return; // no password configured (local dev)
  if (UNAUTHENTICATED_PATHS.some((p) => req.url.startsWith(p))) return;

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!verifyToken(token)) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  reply.header("X-Session-Token", issueToken().token);
});

await registerAuthRoutes(app);
await registerRoutes(app);

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  startPoller();
});
