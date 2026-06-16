import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/token.service";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const tokenFromQuery = req.query.token as string | undefined;
  const raw = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : tokenFromQuery;

  if (!raw) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    req.user = verifyAccessToken(raw);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
