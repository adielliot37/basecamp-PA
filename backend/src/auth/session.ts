import crypto from "node:crypto";
import { config } from "../config.js";

interface SessionPayload {
  exp: number;
}

function sign(payloadB64: string): string {
  return crypto.createHmac("sha256", config.authSessionSecret).update(payloadB64).digest("hex");
}

export function issueToken(ttlMs: number = config.authSessionTtlMs): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ttlMs;
  const payloadB64 = Buffer.from(JSON.stringify({ exp: expiresAt } satisfies SessionPayload)).toString("base64url");
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, expiresAt };
}

export function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;

  const expectedSig = sign(payloadB64);
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}
