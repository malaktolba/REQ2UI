import { Request, Response, NextFunction } from "express";
import { resolveIsAdmin } from "../services/admin.service";

/**
 * Gate for admin-only routes. Must run after requireAuth (relies on req.user).
 * Re-derives admin status from the DB/allowlist rather than trusting the token
 * claim, so revoking admin takes effect immediately.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const ok = await resolveIsAdmin(req.user.sub, req.user.email);
    if (!ok) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify admin access" });
  }
}

/**
 * Inverse gate for the normal-user surface (projects, generation, exports,
 * evaluation). Admin accounts are analytics-only — they don't own projects and
 * must not create or act on them — so they're rejected here. Must run after
 * requireAuth (relies on req.user).
 */
export async function blockAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const isAdmin = await resolveIsAdmin(req.user.sub, req.user.email);
    if (isAdmin) {
      res.status(403).json({ error: "Admin accounts cannot access project resources" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify account type" });
  }
}
