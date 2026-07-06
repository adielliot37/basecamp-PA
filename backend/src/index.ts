import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { seedOauthTokenIfEmpty } from "./db.js";
import { registerRoutes } from "./routes/api.js";
import { startPoller } from "./poller.js";

seedOauthTokenIfEmpty();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.addHook("onRequest", async (req, reply) => {
  if (!config.apiBearer) return; // no auth configured (local dev)
  if (req.headers.authorization !== `Bearer ${config.apiBearer}`) {
    reply.code(401).send({ error: "unauthorized" });
  }
});

await registerRoutes(app);

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  startPoller();
});
