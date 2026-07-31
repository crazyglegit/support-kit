import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const packageDirectories = [
  "ai",
  "cli",
  "contracts",
  "core",
  "dashboard",
  "db-drizzle",
  "notifications",
  "react",
  "realtime-socketio",
  "server-nextjs",
  "storage-s3",
  "support",
  "widget",
] as const;

describe("workspace foundation", () => {
  it.each(packageDirectories)(
    "configures the %s package",
    async (directory) => {
      const packageJsonPath = path.join(
        root,
        "packages",
        directory,
        "package.json",
      );
      const packageJson = JSON.parse(
        await readFile(packageJsonPath, "utf8"),
      ) as {
        scripts?: Record<string, string>;
      };

      expect(packageJson.scripts).toMatchObject({
        build: expect.any(String),
        lint: expect.any(String),
        test: expect.any(String),
        typecheck: expect.any(String),
      });
      await expect(
        stat(path.join(root, "packages", directory, "src/index.ts")),
      ).resolves.toBeDefined();
    },
  );

  it("configures the Next.js example build", async () => {
    const packageJson = JSON.parse(
      await readFile(
        path.join(root, "examples/nextjs-demo/package.json"),
        "utf8",
      ),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts).toMatchObject({
      build: "next build",
      lint: expect.any(String),
      typecheck: expect.any(String),
    });
  });
});
