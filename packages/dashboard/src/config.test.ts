// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { describe, expect, it } from "vitest";
import { resolveDashboardOptions } from "./config.js";

describe("dashboard configuration", () => {
  it("merges safe defaults and strings", () => {
    const target = document.createElement("div");
    const options = resolveDashboardOptions({
      target,
      strings: { inbox: "Queue" },
    });
    expect(options.apiBaseUrl).toBe("/api/support");
    expect(options.strings.inbox).toBe("Queue");
    expect(options.strings.reply).toBe("Reply");
  });
  it.each([
    "projectId",
    "agentId",
    "role",
    "permissions",
    "secretKey",
    "token",
  ])("rejects browser authority key %s", (key) => {
    expect(() =>
      resolveDashboardOptions({
        target: document.createElement("div"),
        [key]: "unsafe",
      } as never),
    ).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "https://user:secret@example.com",
    "https://example.com/?token=x",
    "//example.com",
  ])("rejects unsafe endpoint %s", (apiBaseUrl) => {
    expect(() =>
      resolveDashboardOptions({
        target: document.createElement("div"),
        apiBaseUrl,
      }),
    ).toThrow();
  });
  it("rejects markup in localization overrides", () => {
    expect(() =>
      resolveDashboardOptions({
        target: document.createElement("div"),
        strings: { inbox: '<img src=x onerror="alert(1)">' },
      }),
    ).toThrow();
  });
});
