import { dashboardApiErrorEnvelopeSchema } from "@crazyglegit/support-contracts/dashboard";

export class DashboardHttpError extends Error {
  constructor(
    public readonly kind:
      "auth" | "forbidden" | "validation" | "rate_limit" | "network" | "server",
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}
export class DashboardHttpClient {
  readonly #controllers = new Set<AbortController>();
  constructor(
    private readonly base: string,
    private readonly credentials: RequestCredentials,
    private readonly timeout: number,
  ) {}
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    this.#controllers.add(controller);
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeout);
    try {
      const headers = new Headers(init.headers);
      if (init.body && !headers.has("content-type"))
        headers.set("content-type", "application/json");
      const response = await fetch(`${this.base}${path}`, {
        ...init,
        credentials: this.credentials,
        signal: controller.signal,
        headers,
      });
      const requestId = response.headers.get("x-request-id") ?? undefined;
      const payload: unknown = await response.json().catch(() => {
        return undefined;
      });
      if (!response.ok) {
        const parsed = dashboardApiErrorEnvelopeSchema.safeParse(payload);
        const code = parsed.success ? parsed.data.error.code : "INTERNAL_ERROR";
        const message = parsed.success
          ? parsed.data.error.message
          : "The support request failed.";
        const kind =
          code === "UNAUTHENTICATED"
            ? "auth"
            : code === "FORBIDDEN"
              ? "forbidden"
              : code === "VALIDATION_ERROR"
                ? "validation"
                : code === "RATE_LIMITED"
                  ? "rate_limit"
                  : "server";
        throw new DashboardHttpError(
          kind,
          message,
          parsed.success
            ? (parsed.data.error.requestId ?? requestId)
            : requestId,
        );
      }
      if (!payload || typeof payload !== "object" || !("data" in payload))
        throw new DashboardHttpError(
          "server",
          "The support response was invalid.",
          requestId,
        );
      return (payload as { data: T }).data;
    } catch (error) {
      if (error instanceof DashboardHttpError) throw error;
      throw new DashboardHttpError(
        "network",
        error instanceof DOMException && error.name === "AbortError"
          ? "The support request timed out."
          : "The support service is unavailable.",
      );
    } finally {
      clearTimeout(timer);
      this.#controllers.delete(controller);
    }
  }
  dispose() {
    for (const controller of this.#controllers) controller.abort();
    this.#controllers.clear();
  }
}
