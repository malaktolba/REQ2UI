import "./config/env"; // validate env vars first
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/projects.routes";
import generateRoutes from "./routes/generate.routes";
import exportRoutes from "./routes/export.routes";
import evaluationRoutes from "./routes/evaluation.routes";
import adminRoutes from "./routes/admin.routes";
import { requireAuth } from "./middleware/auth.middleware";
import { blockAdmin } from "./middleware/admin.middleware";

const app = express();

// Render (and most PaaS) run the app behind a reverse proxy that sets the
// X-Forwarded-For header. Without trust proxy, express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and req.ip is wrong. Trust exactly one
// proxy hop (not `true`) so clients can't spoof X-Forwarded-For to dodge
// the rate limiters.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
// Project-scoped APIs are the normal-user surface; admins are analytics-only
// and rejected by blockAdmin (which runs after requireAuth populates req.user).
app.use("/api/projects", requireAuth, blockAdmin, projectRoutes);
app.use("/api/projects", requireAuth, blockAdmin, generateRoutes);
app.use("/api/projects", requireAuth, blockAdmin, exportRoutes);
app.use("/api/projects", requireAuth, blockAdmin, evaluationRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// A transient Neon "fetch failed" inside an async route handler surfaces as an
// unhandled rejection, which by default crashes the whole process. Log it and
// keep serving so a momentary database blip downs one request, not the server.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

app.listen(env.PORT, () => {
  console.log(`Backend running on port ${env.PORT}`);
});
