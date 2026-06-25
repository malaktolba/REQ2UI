/**
 * Unit tests for the UI design preferences config: the prompt-block builder that
 * feeds Stage 10, and the "has any preference" guard. Backward compatibility —
 * an empty/AI-only preferences object must produce no prompt block at all.
 */
import {
  hasUIPreferences,
  uiPreferencesPromptBlock,
  UIPreferences,
} from "../config/uiPreferences";

describe("hasUIPreferences", () => {
  it("is false for undefined, empty, and blank-only objects", () => {
    expect(hasUIPreferences(undefined)).toBe(false);
    expect(hasUIPreferences(null)).toBe(false);
    expect(hasUIPreferences({})).toBe(false);
    expect(hasUIPreferences({ custom_instructions: "   " })).toBe(false);
  });

  it('treats "ai" color mode as no preference', () => {
    expect(hasUIPreferences({ color_mode: "ai" })).toBe(false);
  });

  it("is true once a real choice is present", () => {
    expect(hasUIPreferences({ theme: "minimal" })).toBe(true);
    expect(hasUIPreferences({ color_mode: "dark" })).toBe(true);
  });
});

describe("uiPreferencesPromptBlock", () => {
  it("returns an empty string when no preference is set (default behaviour)", () => {
    expect(uiPreferencesPromptBlock(undefined)).toBe("");
    expect(uiPreferencesPromptBlock({})).toBe("");
    expect(uiPreferencesPromptBlock({ color_mode: "ai" })).toBe("");
  });

  it("renders chosen preferences as constraint lines", () => {
    const prefs: UIPreferences = {
      theme: "glassmorphism",
      color_mode: "dark",
      navigation: "sidebar",
      animations: "rich",
    };
    const block = uiPreferencesPromptBlock(prefs);
    expect(block).toContain("USER UI DESIGN PREFERENCES");
    expect(block).toContain("Glassmorphism");
    expect(block).toContain("DARK theme");
    expect(block).toContain("SIDEBAR");
    expect(block).toMatch(/rich/i);
  });

  it("uses the custom primary colour when color_mode is custom", () => {
    const block = uiPreferencesPromptBlock({ color_mode: "custom", primary_color: "#ff0066" });
    expect(block).toContain("#ff0066");
    expect(block).not.toContain("DARK theme");
  });

  it("includes free-form custom instructions as high priority", () => {
    const block = uiPreferencesPromptBlock({ custom_instructions: "dark fintech dashboard" });
    expect(block).toContain("dark fintech dashboard");
    expect(block).toMatch(/HIGH priority/i);
  });
});
