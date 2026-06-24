/** Unit tests for the requireAuth middleware: header, query-param, and failure paths. */
import { requireAuth } from "../middleware/auth.middleware";
import { signAccessToken } from "../services/token.service";

function mockRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const token = signAccessToken({ sub: "user-1", email: "u@test.com", name: "U" });

describe("requireAuth", () => {
  it("accepts a Bearer token from the Authorization header", () => {
    const req: any = { headers: { authorization: `Bearer ${token}` }, query: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe("user-1");
  });

  it("accepts a token from the query string (SSE path)", () => {
    const req: any = { headers: {}, query: { token } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe("user-1");
  });

  it("401s when no token is present", () => {
    const req: any = { headers: {}, query: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s on an invalid token", () => {
    const req: any = { headers: { authorization: "Bearer not-a-jwt" }, query: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
