export interface DashboardUploadHandle {
  readonly completed: Promise<void>;
  cancel(): void;
}
export function uploadToPresignedTarget(
  target: {
    method: "PUT";
    url: string;
    headers: Readonly<Record<string, string>>;
  },
  file: File,
  onProgress: (value: number) => void,
): DashboardUploadHandle {
  const request = new XMLHttpRequest();
  const completed = new Promise<void>((resolve, reject) => {
    request.open(target.method, target.url);
    request.withCredentials = false;
    request.timeout = 120_000;
    for (const [name, value] of Object.entries(target.headers))
      request.setRequestHeader(name, value);
    const progress = (event: ProgressEvent): void => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    const cleanup = (): void => {
      request.upload.removeEventListener("progress", progress);
    };
    request.upload.addEventListener("progress", progress);
    request.addEventListener(
      "load",
      () => {
        cleanup();
        if (request.status >= 200 && request.status < 300) resolve();
        else reject(new Error("Upload failed."));
      },
      { once: true },
    );
    request.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("Upload failed."));
      },
      { once: true },
    );
    request.addEventListener(
      "timeout",
      () => {
        cleanup();
        reject(new Error("Upload timed out."));
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
