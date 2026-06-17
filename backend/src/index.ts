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
app.use("/api/projects", projectRoutes);
app.use("/api/projects", generateRoutes);
app.use("/api/projects", exportRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(env.PORT, () => {
  console.log(`Backend running on port ${env.PORT}`);
});
