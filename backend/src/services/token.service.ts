import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sql } from "../db/client";
import { env } from "../config/env";
import { JwtPayload } from "../types";

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(
  userId: string,
  family: string
): Promise<string> {
  const raw = crypto.randomBytes(64).toString("hex");
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);

  await sql`
    INSERT INTO refresh_tokens (user_id, token_hash, family, expires_at)
    VALUES (${userId}, ${hash}, ${family}, ${expiresAt})
  `;

  return raw;
}

export async function rotateRefreshToken(
  raw: string
): Promise<{ userId: string; newRaw: string; family: string } | null> {
  const hash = hashToken(raw);

  const rows = await sql`
    SELECT * FROM refresh_tokens
    WHERE token_hash = ${hash}
  ` as any[];

  if (!rows.length) return null;

  const stored = rows[0];

  // Theft detection: if already revoked, revoke entire family
  if (stored.revoked) {
    await sql`
      UPDATE refresh_tokens SET revoked = TRUE
      WHERE family = ${stored.family}
    `;
    return null;
  }

  if (new Date(stored.expires_at) < new Date()) return null;

  // Revoke the used token
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE id = ${stored.id}`;

  const newRaw = await issueRefreshToken(stored.user_id, stored.family);
  return { userId: stored.user_id, newRaw, family: stored.family };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const hash = hashToken(raw);
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ${hash}`;
}
