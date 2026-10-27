import { describe, expect, it } from "vitest";
import { avatarColor, avatarInitials } from "./avatar";

describe("avatarColor", () => {
  it("returns the same color for the same seed", () => {
    expect(avatarColor("octocat")).toBe(avatarColor("octocat"));
  });

  it("returns a hex color string", () => {
    expect(avatarColor("octocat")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("avatarInitials", () => {
  it("takes the first two characters, uppercased", () => {
    expect(avatarInitials("octocat")).toBe("OC");
  });

  it("handles single-character input", () => {
    expect(avatarInitials("a")).toBe("A");
  });

  it("handles an email by using its raw characters", () => {
    expect(avatarInitials("tejas@example.com")).toBe("TE");
  });
});
