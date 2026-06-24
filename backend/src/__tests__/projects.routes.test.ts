/** API tests for project CRUD: auth, validation, ownership scoping. */
import request from "supertest";
import express from "express";

jest.mock("../db/client", () => ({ sql: jest.fn(async () => []) }));

import { sql } from "../db/client";
import { signAccessToken } from "../services/token.service";
import projectsRoutes from "../routes/projects.routes";

const mockSql = sql as jest.MockedFunction<any>;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/projects", projectsRoutes);
  return app;
}

const app = buildApp();
const auth = () => `Bearer ${signAccessToken({ sub: "user-1", email: "u@test.com", name: "U" })}`;

beforeEach(() => {
  jest.clearAllMocks();
  mockSql.mockImplementation(async () => []);
});

describe("auth gate", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).get("/api/projects").set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/projects", () => {
  it("rejects a name that is missing", async () => {
    const res = await request(app).post("/api/projects").set("Authorization", auth())
      .send({ description: "a sufficiently long description" });
    expect(res.status).toBe(400);
  });

  it("rejects a description shorter than 10 chars", async () => {
    const res = await request(app).post("/api/projects").set("Authorization", auth())
      .send({ name: "P", description: "short" });
    expect(res.status).toBe(400);
  });

  it("creates a project and returns 201", async () => {
    mockSql.mockResolvedValueOnce([{ id: "p1", name: "P", description: "a long enough description", status: "pending" }]);
    const res = await request(app).post("/api/projects").set("Authorization", auth())
      .send({ name: "P", description: "a long enough description" });
    expect(res.status).toBe(201);
    expect(res.body.project.id).toBe("p1");
  });
});

describe("GET /api/projects/:id", () => {
  it("returns 404 when the project does not belong to the user", async () => {
    mockSql.mockResolvedValueOnce([]); // ownership-scoped SELECT returns nothing
    const res = await request(app).get("/api/projects/p-unknown").set("Authorization", auth());
    expect(res.status).toBe(404);
  });

  it("returns the project and its pipeline stages", async () => {
    mockSql
      .mockResolvedValueOnce([{ id: "p1", name: "P", artifact_count: 3 }]) // project
      .mockResolvedValueOnce([{ stage: 1, name: "Requirement Extraction", status: "completed" }]); // stages
    const res = await request(app).get("/api/projects/p1").set("Authorization", auth());
    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe("p1");
    expect(res.body.stages).toHaveLength(1);
  });
});

describe("DELETE /api/projects/:id", () => {
  it("returns 404 when nothing was soft-deleted", async () => {
    mockSql.mockResolvedValueOnce([]); // UPDATE ... RETURNING id → no row
    const res = await request(app).delete("/api/projects/p1").set("Authorization", auth());
    expect(res.status).toBe(404);
  });

  it("soft-deletes an owned project", async () => {
    mockSql.mockResolvedValueOnce([{ id: "p1" }]);
    const res = await request(app).delete("/api/projects/p1").set("Authorization", auth());
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});
