import { z } from "zod";
import type { SupportWidgetOptions, SupportWidgetStrings } from "./types.js";

export const ENGLISH_STRINGS: SupportWidgetStrings = {
  launcherLabel: "Open support",
  greeting: "How can we help?",
  newConversation: "Start a conversation",
  conversations: "Your conversations",
  send: "Send",
  retry: "Retry",
  reconnecting: "Reconnecting…",
  offline: "Support is temporarily unavailable. You can retry when connected.",
  loading: "Loading support…",
  noConversations: "No conversations yet.",
  messageFailed: "Message failed to send.",
  back: "Back",
  close: "Close support",
  writeMessage: "Write a message",
  newMessages: "New messages",
  resolved: "This conversation is resolved.",
};

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const safeCss = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !/[{};]/.test(value));
const endpoint = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//"))
      return !value.includes("?") && !value.includes("#");
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, "Endpoints must be relative paths or HTTP(S) URLs without credentials, query strings, or fragments.");
const optionsSchema = z.strictObject({
  apiBaseUrl: endpoint.optional(),
  socketUrl: endpoint.optional(),
  position: z.enum(["bottom-left", "bottom-right"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  title: z.string().trim().min(1).max(100).optional(),
  greeting: z.string().trim().min(1).max(500).optional(),
  launcherLabel: z.string().trim().min(1).max(100).optional(),
  accentColor: color.optional(),
  locale: z.string().trim().min(2).max(35).optional(),
  strings: z.record(z.string(), z.string().max(500)).optional(),
  credentials: z.enum(["omit", "same-origin", "include"]).optional(),
  zIndex: z.number().int().min(100).max(2_147_483_000).optional(),
  maxMessageLength: z.number().int().min(1).max(50_000).optional(),
  requestTimeoutMs: z.number().int().min(1_000).max(60_000).optional(),
  themeVariables: z
    .strictObject({
      background: color.optional(),
      foreground: color.optional(),
      border: color.optional(),
      muted: color.optional(),
      customerBubble: color.optional(),
      agentBubble: color.optional(),
      radius: z.number().min(0).max(32).optional(),
      fontFamily: safeCss.optional(),
      panelWidth: z.number().min(280).max(640).optional(),
      panelHeight: z.number().min(360).max(900).optional(),
    })
    .optional(),
});

export type ResolvedOptions = Omit<
  SupportWidgetOptions,
  "container" | "strings"
> & {
  readonly apiBaseUrl: string;
  readonly position: "bottom-left" | "bottom-right";
  readonly theme: "light" | "dark" | "system";
  readonly title: string;
  readonly credentials: RequestCredentials;
  readonly zIndex: number;
  readonly maxMessageLength: number;
  readonly requestTimeoutMs: number;
  readonly strings: SupportWidgetStrings;
  readonly container?: HTMLElement;
};

export function resolveOptions(options: SupportWidgetOptions): ResolvedOptions {
  const { container, ...serializable } = options;
  const parsed = {
    ...optionsSchema.parse(serializable),
    ...(container ? { container } : {}),
  } as SupportWidgetOptions;
  return {
    ...parsed,
    apiBaseUrl: (parsed.apiBaseUrl ?? "/api/support").replace(/\/$/, ""),
    position: parsed.position ?? "bottom-right",
    theme: parsed.theme ?? "system",
    title: parsed.title ?? "Support",
    credentials: parsed.credentials ?? "same-origin",
    zIndex: parsed.zIndex ?? 2_147_000_000,
    maxMessageLength: parsed.maxMessageLength ?? 5_000,
    requestTimeoutMs: parsed.requestTimeoutMs ?? 12_000,
    strings: {
      ...ENGLISH_STRINGS,
      ...parsed.strings,
      ...(parsed.greeting ? { greeting: parsed.greeting } : {}),
      ...(parsed.launcherLabel ? { launcherLabel: parsed.launcherLabel } : {}),
    },
  };
}
