import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { config } from "../config.js";
import { issueToken } from "../auth/session.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/status", async () => {
    return { required: !!config.authPassword };
  });

  app.post("/api/auth/login", async (req, reply) => {
    if (!config.authPassword) {
      return reply.code(500).send({ error: "auth not configured" });
    }

    const body = req.body as { password?: string };
    const given = Buffer.from(body.password ?? "");
    const expected = Buffer.from(config.authPassword);
    const match = given.length === expected.length && crypto.timingSafeEqual(given, expected);

    if (!match) {
      return reply.code(401).send({ error: "invalid password" });
    }

    const { token, expiresAt } = issueToken();
    return { token, expiresAt };
  });
}
