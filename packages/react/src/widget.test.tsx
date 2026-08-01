// @vitest-environment happy-dom
import { StrictMode, createRef } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  destroy: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  toggle: vi.fn(),
  isOpen: vi.fn(() => false),
}));

vi.mock("@crazyglegit/support-widget", () => ({
  createSupportWidget: mocks.create.mockImplementation(() => ({
    destroy: mocks.destroy,
    open: mocks.open,
    close: mocks.close,
    toggle: mocks.toggle,
    isOpen: mocks.isOpen,
  })),
}));

import { SupportWidget, type SupportWidgetHandle } from "./widget.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe("SupportWidget React integration", () => {
  it("creates one controller under Strict Mode and disposes it once", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <StrictMode>
          <SupportWidget apiBaseUrl="/api/support" />
        </StrictMode>,
      );
      await Promise.resolve();
    });
    expect(mocks.create).toHaveBeenCalledOnce();
    act(() => {
      root.unmount();
    });
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it("exposes only deliberate imperative operations", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const ref = createRef<SupportWidgetHandle>();
    await act(async () => {
      root.render(<SupportWidget ref={ref} />);
      await Promise.resolve();
    });
    ref.current?.open();
    ref.current?.close();
    ref.current?.toggle();
    expect(mocks.open).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.toggle).toHaveBeenCalledOnce();
    act(() => {
      root.unmount();
    });
  });

  it("renders on the server without creating a browser controller", () => {
    expect(renderToString(<SupportWidget />)).toContain(
      "data-support-widget-mount",
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
