import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportWidget } from "./widget.js";
import { SupportDashboard } from "./dashboard.js";

describe("SupportWidget SSR boundary", () => {
  it("imports and renders without browser globals or transport initialization", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
    expect(() => renderToString(<SupportWidget />)).not.toThrow();
    expect(() => renderToString(<SupportDashboard />)).not.toThrow();
  });
});
