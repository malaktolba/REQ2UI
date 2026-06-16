import { neon } from "@neondatabase/serverless";
import { env } from "../config/env";

export const sql = neon(env.DATABASE_URL);
