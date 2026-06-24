/** Unit tests for JWT signing and refresh-token rotation / theft detection. */
jest.mock("../db/client", () => ({ sql: jest.fn(async () => []) }));

import { sql } from "../db/client";
import {
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/token.service";

const mockSql = sql as jest.MockedFunction<any>;
const payload = { sub: "user-1", email: "u@test.com", name: "U" };

beforeEach(() => {
  jest.clearAllMocks();
  mockSql.mockImplementation(async () => []);
});

describe("access tokens", () => {
  it("signs a token that verifies back to the same payload", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.email).toBe("u@test.com");
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken(payload);
    expect(() => verifyAccessToken(token + "x")).toThrow();
  });
});

describe("issueRefreshToken", () => {
  it("inserts a hashed token and returns the raw value", async () => {
    const raw = await issueRefreshToken("user-1", "fam-1");
    expect(typeof raw).toBe("string");
    expect(raw.length).toBeGreaterThan(64);
    expect(mockSql).toHaveBeenCalledTimes(1);
    // The raw token is never the value stored (a SHA-256 hash is stored instead).
    const interpolated = mockSql.mock.calls[0].slice(1);
    expect(interpolated).not.toContain(raw);
  });
});

describe("rotateRefreshToken", () => {
  it("returns null when the token is unknown", async () => {
    mockSql.mockResolvedValueOnce([]); // SELECT finds nothing
    expect(await rotateRefreshToken("nope")).toBeNull();
  });

  it("revokes the whole family and returns null on a reused (already-revoked) token", async () => {
    mockSql.mockResolvedValueOnce([
      { id: "t1", user_id: "user-1", family: "fam-1", revoked: true, expires_at: new Date(Date.now() + 1e6) },
    ]);
    const result = await rotateRefreshToken("reused");
    expect(result).toBeNull();
    const calls = mockSql.mock.calls.map((c: any[]) => String(c[0]?.join?.("") ?? ""));
    expect(calls.some((q: string) => /UPDATE refresh_tokens SET revoked = TRUE\s*WHERE family/.test(q))).toBe(true);
  });

  it("returns null for an expired token", async () => {
    mockSql.mockResolvedValueOnce([
      { id: "t1", user_id: "user-1", family: "fam-1", revoked: false, expires_at: new Date(Date.now() - 1000) },
    ]);
    expect(await rotateRefreshToken("expired")).toBeNull();
  });

  it("revokes the old token and issues a new one for a valid token", async () => {
    mockSql
      .mockResolvedValueOnce([
        { id: "t1", user_id: "user-1", family: "fam-1", revoked: false, expires_at: new Date(Date.now() + 1e6) },
      ]) // SELECT
      .mockResolvedValueOnce([]) // UPDATE revoke old
      .mockResolvedValueOnce([]); // INSERT new (issueRefreshToken)

    const result = await rotateRefreshToken("good");
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-1");
    expect(result!.family).toBe("fam-1");
    expect(typeof result!.newRaw).toBe("string");
  });
});

describe("revokeRefreshToken", () => {
  it("marks the matching token revoked", async () => {
    await revokeRefreshToken("some-raw");
    const q = String(mockSql.mock.calls[0][0].join(""));
    expect(q).toMatch(/UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash/);
  });
});
