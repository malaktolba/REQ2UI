import { screenCategory, selectDistinctScreens, sanitizeMermaid } from "../services/pipeline.service";

describe("screenCategory", () => {
  it.each([
    ["Login", "/login", "auth"],
    ["Sign Up", "/register", "auth"],
    ["Forgot Password", "/forgot", "auth"],
    ["Dashboard", "/dashboard", "dashboard"],
    ["Settings", "/settings", "settings"],
    ["My Profile", "/profile", "profile"],
    ["Create Course", "/courses/new", "create"],
    ["Manage Users", "/users", "list"],
    ["Sales Statistics", "/stats", "report"],
  ])("categorises %s as %s", (name, route, expected) => {
    expect(screenCategory({ name, route, description: "" })).toBe(expected);
  });

  it("treats an unrecognised screen as distinct (uncategorised)", () => {
    const cat = screenCategory({ id: "SCR-9", name: "Wizard Step 3", route: "/wizard/3" });
    expect(cat).toMatch(/^__/);
  });
});

describe("selectDistinctScreens", () => {
  const screens = [
    { id: "1", name: "Login", route: "/login" },
    { id: "2", name: "Register", route: "/register" },   // same category as Login (auth)
    { id: "3", name: "Dashboard", route: "/dashboard" },
    { id: "4", name: "Settings", route: "/settings" },
  ];

  it("deduplicates by category when distinct screens fill the limit", () => {
    // 3 distinct categories (auth, dashboard, settings) exactly fill limit 3,
    // so the duplicate auth screen (Register) is dropped rather than backfilled.
    const picked = selectDistinctScreens(screens, 3);
    const names = picked.map((s) => s.name);
    expect(names).toContain("Login");
    expect(names).not.toContain("Register"); // deduped — both are auth
    expect(names).toContain("Dashboard");
    expect(names).toContain("Settings");
    expect(picked).toHaveLength(3);
  });

  it("backfills with deduped leftovers when distinct screens don't fill the limit", () => {
    const picked = selectDistinctScreens(screens, 4);
    // 3 distinct + 1 backfilled leftover (Register) to reach the limit.
    expect(picked).toHaveLength(4);
    expect(picked.map((s) => s.name)).toContain("Register");
  });

  it("never returns more than the limit", () => {
    const picked = selectDistinctScreens(screens, 2);
    expect(picked).toHaveLength(2);
  });

  it("handles an empty screen list", () => {
    expect(selectDistinctScreens([], 6)).toEqual([]);
  });
});

describe("sanitizeMermaid", () => {
  it("strips a leading ```mermaid fence and trailing fence", () => {
    const out = sanitizeMermaid("```mermaid\nflowchart TD\n  A --> B\n```");
    expect(out).toBe("flowchart TD\n  A --> B");
  });

  it("strips a bare ``` fence", () => {
    expect(sanitizeMermaid("```\ngraph LR\n```")).toBe("graph LR");
  });

  it("trims trailing whitespace per line", () => {
    expect(sanitizeMermaid("flowchart TD   \n  A --> B  ")).toBe("flowchart TD\n  A --> B");
  });

  it("passes non-string values through untouched", () => {
    expect(sanitizeMermaid(undefined)).toBeUndefined();
    expect(sanitizeMermaid(42 as any)).toBe(42);
  });
});
