import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { sql } from "../db/client";
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/token.service";
import { requireAuth } from "../middleware/auth.middleware";
import { User } from "../types";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post("/register", authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password, name } = parsed.data;

  const existing = await sql`SELECT id FROM users WHERE email = ${email}` as any[];
  if (existing.length) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);
  const rows = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${password_hash}, ${name})
    RETURNING id, email, name, created_at
  ` as any[];

  const user = rows[0];
  const family = uuidv4();
  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  const refreshRaw = await issueRefreshToken(user.id, family);

  res.cookie("refresh_token", refreshRaw, COOKIE_OPTS);
  res.status(201).json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const rows = await sql`SELECT * FROM users WHERE email = ${email}` as User[];
  if (!rows.length) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const user = rows[0];

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    res.status(429).json({ error: "Account temporarily locked. Try again later." });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = user.failed_attempts + 1;
    if (attempts >= 5) {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await sql`
        UPDATE users SET failed_attempts = ${attempts}, locked_until = ${lockedUntil}
        WHERE id = ${user.id}
      `;
      res.status(429).json({ error: "Too many failed attempts. Account locked for 15 minutes." });
    } else {
      await sql`UPDATE users SET failed_attempts = ${attempts} WHERE id = ${user.id}`;
      res.status(401).json({ error: "Invalid credentials" });
    }
    return;
  }

  // Reset on success
  await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${user.id}`;

  const family = uuidv4();
  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });
  const refreshRaw = await issueRefreshToken(user.id, family);

  res.cookie("refresh_token", refreshRaw, COOKIE_OPTS);
  res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  const raw = req.cookies?.refresh_token;
  if (!raw) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  const result = await rotateRefreshToken(raw);
  if (!result) {
    res.clearCookie("refresh_token", { path: "/api/auth" });
    res.status(401).json({ error: "Refresh token invalid or expired" });
    return;
  }

  const rows = await sql`
    SELECT id, email, name FROM users WHERE id = ${result.userId}
  ` as any[];

  if (!rows.length) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const user = rows[0];
  const accessToken = signAccessToken({ sub: user.id, email: user.email, name: user.name });

  res.cookie("refresh_token", result.newRaw, COOKIE_OPTS);
  res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
});

// POST /api/auth/logout
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  const raw = req.cookies?.refresh_token;
  if (raw) await revokeRefreshToken(raw);
  res.clearCookie("refresh_token", { path: "/api/auth" });
  res.json({ message: "Logged out" });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const rows = await sql`
    SELECT id, email, name, created_at FROM users WHERE id = ${req.user!.sub}
  ` as any[];

  if (!rows.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user: rows[0] });
});

export default router;
