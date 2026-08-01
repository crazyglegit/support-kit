/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser package boundary", () => {
  const production = [
    "config.ts",
    "controller.ts",
    "http.ts",
    "index.ts",
    "types.ts",
  ]
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");
  it("does not import server-only packages", () =>
    expect(production).not.toMatch(
      /support-(core|application|db-drizzle)|drizzle-orm|repository|transaction/,
    ));
  it("uses a self-contained browser contracts entrypoint", () => {
    const contracts = readFileSync(
      new URL("../../contracts/src/dashboard.ts", import.meta.url),
      "utf8",
    );
    expect(contracts).not.toMatch(/support-core|\.\/enums|\.\/index/);
    expect(contracts).toMatch(/\.\/api\.js|\.\/shared\.js/);
  });
  it("does not store credentials or render arbitrary HTML", () =>
    expect(production).not.toMatch(
      /localStorage|sessionStorage|dangerouslySetInnerHTML|document\.cookie/,
    ));
  it("has no production debug or unfinished markers", () =>
    expect(production).not.toMatch(/console\.|TODO|FIXME/));
  it("keeps the public entrypoint deliberate", () =>
    expect(
      readFileSync(new URL("index.ts", import.meta.url), "utf8"),
    ).not.toMatch(/Http|mergeMessages|Socket|Store/));
  it("does not bundle React", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(packageJson.dependencies?.react).toBeUndefined();
  });
});
