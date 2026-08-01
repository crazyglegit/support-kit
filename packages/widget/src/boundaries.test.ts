import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forbiddenBrowserImports = [
  "@crazyglegit/support-core",
  "@crazyglegit/support-application",
  "@crazyglegit/support-db-drizzle",
  "@crazyglegit/support-nextjs",
  "@crazyglegit/support-realtime-socketio",
  'from "@crazyglegit/support"',
];

describe("browser package boundaries", () => {
  it("imports only the browser-safe public contracts subpath and browser libraries", async () => {
    const sources = await Promise.all(
      ["config.ts", "controller.ts", "http.ts", "index.ts", "types.ts"].map(
        (file) => readFile(new URL(file, import.meta.url), "utf8"),
      ),
    );
    const graph = sources.join("\n");
    for (const forbidden of forbiddenBrowserImports)
      expect(graph).not.toContain(forbidden);
    expect(graph).toContain("@crazyglegit/support-contracts/widget");
    expect(graph).not.toContain('from "@crazyglegit/support-contracts"');
  });

  it("keeps the public entry point deliberate", async () => {
    const entry = await readFile(new URL("index.ts", import.meta.url), "utf8");
    expect(entry).not.toMatch(/http|Socket|store|serializer|repository/i);
    expect(entry).toContain("createSupportWidget");
    expect(entry).toContain("SupportWidgetController");
  });

  it("contains no browser persistence, debug output, or unfinished markers", async () => {
    const sources = await Promise.all(
      ["config.ts", "controller.ts", "http.ts", "index.ts", "types.ts"].map(
        (file) => readFile(new URL(file, import.meta.url), "utf8"),
      ),
    );
    expect(sources.join("\n")).not.toMatch(
      /localStorage|sessionStorage|console\.|TODO|FIXME/,
    );
  });

  it("keeps React out of the widget and as a peer of the React wrapper", async () => {
    const widgetPackage = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const reactPackage = JSON.parse(
      await readFile(
        new URL("../../react/package.json", import.meta.url),
        "utf8",
      ),
    ) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    expect(widgetPackage.dependencies).not.toHaveProperty("react");
    expect(reactPackage.dependencies).not.toHaveProperty("react");
    expect(reactPackage.peerDependencies).toHaveProperty("react");
  });
});
