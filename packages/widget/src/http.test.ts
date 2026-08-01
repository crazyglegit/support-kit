import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WidgetHttpClient, WidgetRequestError } from "./http.js";

afterEach(() => vi.unstubAllGlobals());

describe("widget HTTP client", () => {
  it("maps structured authentication errors without leaking details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            success: false,
            error: { code: "UNAUTHENTICATED", message: "Session expired" },
          },
          { status: 401 },
        ),
      ),
    );
    const client = new WidgetHttpClient("/api/support", "same-origin", 1_000);
    await expect(client.request("/session", z.unknown())).rejects.toMatchObject(
      {
        kind: "authentication",
        message: "Session expired",
      } satisfies Partial<WidgetRequestError>,
    );
  });

  it("aborts all pending work during disposal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new Error("abort"));
            });
          }),
      ),
    );
    const client = new WidgetHttpClient("/api/support", "same-origin", 10_000);
    const pending = client.request("/session", z.unknown());
    client.dispose();
    await expect(pending).rejects.toMatchObject({ kind: "timeout" });
  });
});
