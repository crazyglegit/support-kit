import { widgetApiErrorEnvelopeSchema } from "@crazyglegit/support-contracts/widget";
import { z } from "zod";

export type WidgetErrorKind =
  | "authentication"
  | "validation"
  | "rate_limit"
  | "network"
  | "timeout"
  | "server"
  | "not_found";
export class WidgetRequestError extends Error {
  public constructor(
    public readonly kind: WidgetErrorKind,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export class WidgetHttpClient {
  readonly #pending = new Set<AbortController>();
  public constructor(
    private readonly base: string,
    private readonly credentials: RequestCredentials,
    private readonly timeoutMs: number,
  ) {}
  public async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init?: RequestInit,
  ): Promise<T> {
    const controller = new AbortController();
    this.#pending.add(controller);
    const timer = setTimeout(() => {
      controller.abort("timeout");
    }, this.timeoutMs);
    try {
      const headers = new Headers(init?.headers);
      if (init?.body) headers.set("content-type", "application/json");
      const response = await fetch(`${this.base}${path}`, {
        ...init,
        credentials: this.credentials,
        signal: controller.signal,
        headers,
      });
      const value: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        const parsed = widgetApiErrorEnvelopeSchema.safeParse(value);
        const code = parsed.success ? parsed.data.error.code : "INTERNAL_ERROR";
        const kind: WidgetErrorKind =
          code === "UNAUTHENTICATED"
            ? "authentication"
            : code === "VALIDATION_ERROR"
              ? "validation"
              : code === "RATE_LIMITED"
                ? "rate_limit"
                : code === "NOT_FOUND"
                  ? "not_found"
                  : "server";
        throw new WidgetRequestError(
          kind,
          parsed.success
            ? parsed.data.error.message
            : "Support is temporarily unavailable.",
          response.headers.get("x-request-id") ?? undefined,
        );
      }
      return z
        .strictObject({ success: z.literal(true), data: schema })
        .parse(value).data;
    } catch (error) {
      if (error instanceof WidgetRequestError) throw error;
      if (controller.signal.aborted)
        throw new WidgetRequestError(
          "timeout",
          "The support request timed out.",
        );
      throw new WidgetRequestError("network", "Unable to reach support.");
    } finally {
      clearTimeout(timer);
      this.#pending.delete(controller);
    }
  }
  public dispose(): void {
    for (const request of this.#pending) request.abort("disposed");
    this.#pending.clear();
  }
}
