// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { uploadToPresignedTarget } from "./upload.js";

class FakeUpload extends EventTarget {}
class FakeRequest extends EventTarget {
  static last: FakeRequest | undefined;
  readonly upload = new FakeUpload();
  status = 200;
  withCredentials = true;
  timeout = 0;
  readonly headers = new Map<string, string>();
  constructor() {
    super();
    FakeRequest.last = this;
  }
  open = vi.fn();
  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }
  send = vi.fn();
  abort() {
    this.dispatchEvent(new Event("abort"));
  }
}

describe("direct attachment upload", () => {
  it("uses only prescribed headers, reports progress, and sends no credentials", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeRequest);
    const progress = vi.fn();
    const handle = uploadToPresignedTarget(
      {
        method: "PUT",
        url: "https://storage.test/signed",
        headers: { "content-type": "text/plain" },
      },
      new File(["test"], "safe.txt", { type: "text/plain" }),
      progress,
    );
    const request = FakeRequest.last;
    if (!request) throw new Error("Upload request was not created.");
    const event = new Event("progress") as ProgressEvent;
    Object.defineProperties(event, {
      lengthComputable: { value: true },
      loaded: { value: 2 },
      total: { value: 4 },
    });
    request.upload.dispatchEvent(event);
    request.dispatchEvent(new Event("load"));
    await expect(handle.completed).resolves.toBeUndefined();
    expect(request.withCredentials).toBe(false);
    expect(request.headers).toEqual(new Map([["content-type", "text/plain"]]));
    expect(progress).toHaveBeenCalledWith(50);
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it("aborts and removes the progress lifecycle", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeRequest);
    const handle = uploadToPresignedTarget(
      { method: "PUT", url: "https://storage.test/signed", headers: {} },
      new File(["test"], "safe.txt"),
      vi.fn(),
    );
    handle.cancel();
    await expect(handle.completed).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
