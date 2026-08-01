export interface DirectUploadHandle {
  readonly completed: Promise<void>;
  cancel(): void;
}

/** Internal credential-free direct upload with progress and cancellation. */
export function uploadToPresignedTarget(
  target: {
    readonly method: "PUT";
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
  },
  file: File,
  onProgress: (percentage: number) => void,
  timeoutMs = 120_000,
): DirectUploadHandle {
  const request = new XMLHttpRequest();
  const completed = new Promise<void>((resolve, reject) => {
    request.open(target.method, target.url, true);
    request.withCredentials = false;
    request.timeout = timeoutMs;
    for (const [name, value] of Object.entries(target.headers))
      request.setRequestHeader(name, value);
    const progress = (event: ProgressEvent): void => {
      if (event.lengthComputable)
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
    };
    const cleanup = (): void => {
      request.upload.removeEventListener("progress", progress);
    };
    request.upload.addEventListener("progress", progress);
    request.addEventListener(
      "load",
      () => {
        cleanup();
        if (request.status >= 200 && request.status < 300) {
          onProgress(100);
          resolve();
        } else
          reject(
            new Error(
              request.status === 403 ? "UPLOAD_EXPIRED" : "UPLOAD_FAILED",
            ),
          );
      },
      { once: true },
    );
    request.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("UPLOAD_FAILED"));
      },
      { once: true },
    );
    request.addEventListener(
      "timeout",
      () => {
        cleanup();
        reject(new Error("UPLOAD_TIMEOUT"));
      },
      { once: true },
    );
    request.addEventListener(
      "abort",
      () => {
        cleanup();
        reject(new DOMException("Upload cancelled", "AbortError"));
      },
      { once: true },
    );
    request.send(file);
  });
  return {
    completed,
    cancel: () => {
      request.abort();
    },
  };
}
