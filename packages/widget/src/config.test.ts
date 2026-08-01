import { describe, expect, it } from "vitest";
import { ENGLISH_STRINGS, resolveOptions } from "./config.js";

describe("widget configuration", () => {
  it("applies safe defaults and localization overrides", () => {
    const options = resolveOptions({ strings: { send: "Submit" } });
    expect(options.apiBaseUrl).toBe("/api/support");
    expect(options.strings).toEqual({ ...ENGLISH_STRINGS, send: "Submit" });
  });

  it("rejects unsafe theme values and out-of-range z indexes", () => {
    expect(() => resolveOptions({ accentColor: "red" })).toThrow();
    expect(() => resolveOptions({ zIndex: 2_147_483_647 })).toThrow();
    expect(() =>
      resolveOptions({ themeVariables: { fontFamily: "x;display:none" } }),
    ).toThrow();
    expect(() =>
      resolveOptions({ apiBaseUrl: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      resolveOptions({ socketUrl: "https://token@example.test?secret=x" }),
    ).toThrow();
  });

  it("rejects identity, tenancy, permission, and secret configuration", () => {
    for (const forbidden of [
      "projectId",
      "customerId",
      "visitorId",
      "agentId",
      "role",
      "permissions",
      "secretKey",
    ]) {
      expect(() => resolveOptions({ [forbidden]: "forbidden" })).toThrow();
    }
  });

  it("normalizes a trailing API slash", () => {
    expect(resolveOptions({ apiBaseUrl: "/support/" }).apiBaseUrl).toBe(
      "/support",
    );
  });
});
