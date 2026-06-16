import "./config/env"; // validate env vars first
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/projects.routes";
import generateRoutes from "./routes/generate.routes";

const app = express();

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

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(env.PORT, () => {
  console.log(`Backend running on port ${env.PORT}`);
});
