import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

// ── Mock the DB and token service before any route imports ──────────────────

jest.mock("../db/client", () => ({
  sql: jest.fn(),
}));

// Bypass rate limiting in tests
jest.mock("express-rate-limit", () => () => (_req: any, _res: any, next: any) => next());

jest.mock("../services/token.service", () => ({
  signAccessToken: jest.fn(() => "mock-access-token"),
  issueRefreshToken: jest.fn(async () => "mock-refresh-raw"),
  rotateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
}));

import { sql } from "../db/client";
import { signAccessToken, issueRefreshToken, revokeRefreshToken } from "../services/token.service";
import authRoutes from "../routes/auth.routes";

const mockSql = sql as jest.MockedFunction<any>;
const mockSign = signAccessToken as jest.MockedFunction<typeof signAccessToken>;
const mockIssue = issueRefreshToken as jest.MockedFunction<typeof issueRefreshToken>;
const mockRevoke = revokeRefreshToken as jest.MockedFunction<typeof revokeRefreshToken>;

// ── Build a minimal Express app for testing ──────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for missing fields", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "bad" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "user@test.com",
      password: "short",
      name: "Test",
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when email already exists", async () => {
    mockSql.mockResolvedValueOnce([{ id: "existing-id" }]); // SELECT returns a row
    const res = await request(app).post("/api/auth/register").send({
      email: "taken@test.com",
      password: "password123",
      name: "Test",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it("returns 201 and accessToken on successful registration", async () => {
    mockSql
      .mockResolvedValueOnce([])  // SELECT — email not taken
      .mockResolvedValueOnce([{ id: "new-user-id", email: "new@test.com", name: "Test" }]); // INSERT RETURNING

    const res = await request(app).post("/api/auth/register").send({
      email: "new@test.com",
      password: "password123",
      name: "Test",
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBe("mock-access-token");
    expect(res.body.user.email).toBe("new@test.com");
    expect(mockSign).toHaveBeenCalledTimes(1);
    expect(mockIssue).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/auth/login", () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for missing credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 when user does not exist", async () => {
    mockSql.mockResolvedValueOnce([]); // no user found
    const res = await request(app).post("/api/auth/login").send({
      email: "ghost@test.com",
      password: "password123",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it("returns 200 and accessToken on valid credentials", async () => {
    // bcrypt hash of "password123"
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("password123", 1);

    mockSql
      .mockResolvedValueOnce([{
        id: "user-id",
        email: "user@test.com",
        name: "Test",
        password_hash: hash,
        failed_attempts: 0,
        locked_until: null,
      }])
      .mockResolvedValueOnce([]); // UPDATE reset failed_attempts

    const res = await request(app).post("/api/auth/login").send({
      email: "user@test.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe("mock-access-token");
  });

  it("returns 401 on wrong password", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("correctpass", 1);

    mockSql
      .mockResolvedValueOnce([{
        id: "user-id",
        email: "user@test.com",
        name: "Test",
        password_hash: hash,
        failed_attempts: 0,
        locked_until: null,
      }])
      .mockResolvedValueOnce([]); // UPDATE failed_attempts

    const res = await request(app).post("/api/auth/login").send({
      email: "user@test.com",
      password: "wrongpass",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });
});

describe("POST /api/auth/logout", () => {
  const app = buildApp();

  it("returns 200 and clears cookie", async () => {
    mockRevoke.mockResolvedValueOnce(undefined as any);
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", "refresh_token=some-token");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });
});
