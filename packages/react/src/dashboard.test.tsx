// @vitest-environment happy-dom
import { StrictMode, act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  initialize,
  destroy,
  refreshInbox,
  closeConversation,
  createSupportDashboard,
} = vi.hoisted(() => {
  const initialize = vi.fn();
  const destroy = vi.fn();
  const refreshInbox = vi.fn();
  const closeConversation = vi.fn();
  return {
    initialize,
    destroy,
    refreshInbox,
    closeConversation,
    createSupportDashboard: vi.fn(() => ({
      initialize,
      destroy,
      refreshInbox,
      closeConversation,
    })),
  };
});
vi.mock("@crazyglegit/support-dashboard", () => ({ createSupportDashboard }));
import { SupportDashboard, type SupportDashboardHandle } from "./dashboard.js";

describe("SupportDashboard React integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });
  it("creates only one controller through a Strict Mode development remount", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <StrictMode>
          <SupportDashboard />
        </StrictMode>,
      );
      await Promise.resolve();
    });
    expect(createSupportDashboard).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    act(() => {
      root.unmount();
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });
  it("exposes only deliberate imperative operations", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const ref = createRef<SupportDashboardHandle>();
    await act(async () => {
      root.render(<SupportDashboard ref={ref} />);
      await Promise.resolve();
    });
    await ref.current?.refreshInbox();
    ref.current?.closeConversation();
    expect(refreshInbox).toHaveBeenCalledOnce();
    expect(closeConversation).toHaveBeenCalledOnce();
    act(() => {
      root.unmount();
    });
  });
});
