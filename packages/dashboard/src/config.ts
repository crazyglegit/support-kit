import { z } from "zod";
import type {
  SupportDashboardOptions,
  SupportDashboardStrings,
} from "./types.js";

export const defaultStrings: SupportDashboardStrings = {
  inbox: "Inbox",
  assignedToMe: "Assigned to me",
  allConversations: "All conversations",
  reply: "Reply",
  internalNote: "Internal note",
  send: "Send",
  retry: "Retry",
  assignToMe: "Assign to me",
  resolve: "Resolve",
  reopen: "Reopen",
  markSpam: "Mark as spam",
  loading: "Loading support inbox…",
  reconnecting: "Reconnecting…",
  offline: "Realtime unavailable. Changes still save over HTTP.",
  noConversations: "No conversations match this view.",
  unauthorized: "You do not have access to the support inbox.",
  customerDetails: "Customer details",
  selectConversation: "Select a conversation to start.",
  back: "Back to inbox",
  refresh: "Refresh",
};
const endpoint = z
  .string()
  .min(1)
  .refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//"))
      return !/[?#]/.test(value);
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
  }, "Endpoint must be a safe HTTP(S) URL or root-relative path.");
const schema = z.strictObject({
  target: z.custom<HTMLElement>(
    (v) => typeof HTMLElement !== "undefined" && v instanceof HTMLElement,
  ),
  apiBaseUrl: endpoint.default("/api/support"),
  socketUrl: endpoint.optional(),
  credentials: z
    .enum(["omit", "same-origin", "include"])
    .default("same-origin"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  layout: z.enum(["auto", "desktop", "compact"]).default("auto"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#2563eb"),
  strings: z
    .record(
      z.string(),
      z
        .string()
        .min(1)
        .max(200)
        .refine((value) => !/[<>&]/.test(value), {
          message: "Dashboard strings cannot contain markup characters.",
        }),
    )
    .optional(),
  requestTimeoutMs: z.number().int().min(1_000).max(60_000).default(15_000),
  initialFilters: z
    .strictObject({
      status: z
        .enum([
          "open",
          "waiting_for_agent",
          "waiting_for_customer",
          "resolved",
          "closed",
          "spam",
        ])
        .optional(),
      assignment: z.enum(["all", "mine"]).optional(),
    })
    .optional(),
});
export function resolveDashboardOptions(options: SupportDashboardOptions) {
  const value = schema.parse(options);
  return {
    ...value,
    socketUrl: value.socketUrl ?? globalThis.location.origin,
    strings: { ...defaultStrings, ...value.strings },
  };
}
