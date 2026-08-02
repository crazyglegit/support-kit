/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-non-null-assertion, @typescript-eslint/non-nullable-type-assertion-style, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion */
import {
  dashboardAgentSessionSchema,
  dashboardConversationDetailSchema,
  dashboardConversationSchema,
  dashboardMessageSchema,
  dashboardSocketEventEnvelopeSchema,
  publicKnowledgeArticleSchema,
  type DashboardAgentSession,
  type DashboardConversation,
  type DashboardMessage,
  type PublicKnowledgeArticle,
} from "@crazyglegit/support-contracts/dashboard";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";
import { resolveDashboardOptions } from "./config.js";
import { DashboardHttpClient, DashboardHttpError } from "./http.js";
import {
  uploadToPresignedTarget,
  type DashboardUploadHandle,
} from "./upload.js";
import type {
  SupportDashboardEvent,
  SupportDashboardEventName,
  SupportDashboardFilters,
  SupportDashboardListener,
  SupportDashboardOptions,
} from "./types.js";

type Connection = "connecting" | "connected" | "reconnecting" | "offline";
type Mode = "reply" | "note";
interface PendingUpload {
  readonly localId: string;
  readonly file: File;
  attachmentId?: string;
  status: "uploading" | "ready" | "failed" | "cancelled";
  progress: number;
  error?: string;
  handle?: DashboardUploadHandle;
}
const attachmentSchema = z.strictObject({
  id: z.string().min(1),
  fileName: z.string().min(1),
  mediaType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  status: z.literal("ready"),
});
const attachmentConfigSchema = z.looseObject({
  features: z.strictObject({
    attachments: z.boolean(),
    chatbot: z.boolean(),
  }),
  attachments: z
    .strictObject({
      maxFileSizeBytes: z.number().int().positive(),
      maxFilesPerMessage: z.number().int().positive(),
      allowedMimeTypes: z.array(z.string()),
    })
    .optional(),
});
const uploadIntentSchema = z.strictObject({
  attachment: attachmentSchema
    .omit({ status: true })
    .extend({ status: z.literal("pending_upload") }),
  upload: z.strictObject({
    method: z.literal("PUT"),
    url: z.url(),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string(),
  }),
});
const css = `
.sk-dashboard{--sk-accent:#2563eb;--sk-bg:#f8fafc;--sk-panel:#fff;--sk-fg:#172033;--sk-muted:#64748b;--sk-border:#dce3ec;min-height:620px;height:min(820px,calc(100vh - 32px));display:grid;grid-template-columns:minmax(280px,330px) minmax(360px,1fr) minmax(260px,310px);color:var(--sk-fg);background:var(--sk-bg);border:1px solid var(--sk-border);border-radius:16px;overflow:hidden;font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light}
.sk-dashboard[data-theme=dark]{--sk-bg:#0b1120;--sk-panel:#111827;--sk-fg:#e5e7eb;--sk-muted:#9ca3af;--sk-border:#293548;color-scheme:dark}.sk-panel{min-width:0;background:var(--sk-panel);border-right:1px solid var(--sk-border);display:flex;flex-direction:column}.sk-panel:last-child{border:0}.sk-head{padding:16px;border-bottom:1px solid var(--sk-border);display:flex;align-items:center;gap:8px;min-height:48px}.sk-head h1,.sk-head h2{font-size:16px;margin:0;flex:1}.sk-controls{display:flex;gap:8px;flex-wrap:wrap}.sk-btn,.sk-select{min-height:40px;border:1px solid var(--sk-border);border-radius:9px;background:var(--sk-panel);color:var(--sk-fg);padding:8px 11px;font:inherit}.sk-btn{cursor:pointer}.sk-btn-primary{background:var(--sk-accent);border-color:var(--sk-accent);color:#fff}.sk-btn-note[aria-pressed=true]{background:#fef3c7;color:#713f12;border-color:#f59e0b}.sk-btn:focus-visible,.sk-select:focus-visible,.sk-compose:focus-visible,.sk-item:focus-visible{outline:3px solid color-mix(in srgb,var(--sk-accent) 45%,transparent);outline-offset:2px}.sk-inbox{overflow:auto;list-style:none;padding:8px;margin:0}.sk-item{width:100%;text-align:left;border:0;border-bottom:1px solid var(--sk-border);background:transparent;color:inherit;padding:13px;border-radius:9px;cursor:pointer}.sk-item:hover,.sk-item[aria-current=true]{background:color-mix(in srgb,var(--sk-accent) 9%,var(--sk-panel))}.sk-item strong,.sk-item span{display:block}.sk-meta{color:var(--sk-muted);font-size:12px;margin-top:4px}.sk-state{margin:auto;padding:28px;text-align:center;color:var(--sk-muted)}.sk-timeline{flex:1;overflow:auto;padding:20px;overscroll-behavior:contain}.sk-message{max-width:74%;margin:10px 0;padding:10px 12px;background:#e7eef8;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere}.sk-message-agent{margin-left:auto;background:color-mix(in srgb,var(--sk-accent) 16%,var(--sk-panel))}.sk-message-note{max-width:86%;background:#fef3c7;color:#713f12;border:1px solid #f59e0b}.sk-message-note::before{content:"Internal note";display:block;font-weight:700;font-size:12px;margin-bottom:5px}.sk-compose-wrap{border-top:1px solid var(--sk-border);padding:12px}.sk-compose{box-sizing:border-box;width:100%;min-height:86px;resize:vertical;border:1px solid var(--sk-border);border-radius:10px;background:var(--sk-panel);color:var(--sk-fg);padding:10px;font:inherit}.sk-compose-actions{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sk-compose-actions .sk-send{margin-left:auto}.sk-live{padding:7px 14px;background:color-mix(in srgb,var(--sk-accent) 8%,var(--sk-panel));color:var(--sk-muted)}.sk-detail{padding:18px;overflow:auto}.sk-detail dl{margin:0}.sk-detail dt{font-weight:700;margin-top:14px}.sk-detail dd{margin:3px 0;color:var(--sk-muted)}.sk-back{display:none}.sk-visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.sk-files{display:grid;gap:6px;margin-top:8px}.sk-file{display:flex;align-items:center;gap:8px;border:1px solid var(--sk-border);border-radius:8px;padding:7px;min-width:0}.sk-file span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sk-file progress{width:90px}.sk-file-note{border-color:#d97706;background:#fffbeb}.sk-file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
@media(max-width:980px){.sk-dashboard{grid-template-columns:300px 1fr}.sk-context{display:none}}@media(max-width:680px){.sk-dashboard{position:fixed;inset:0;width:100%;height:100dvh;min-height:0;border:0;border-radius:0;grid-template-columns:1fr;padding-bottom:env(safe-area-inset-bottom)}.sk-dashboard[data-mobile-view=conversation] .sk-inbox-panel{display:none}.sk-dashboard:not([data-mobile-view=conversation]) .sk-conversation{display:none}.sk-back{display:inline-flex}.sk-message{max-width:88%}.sk-file{flex-wrap:wrap}}@media(prefers-reduced-motion:reduce){.sk-dashboard *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
`;

function id() {
  return globalThis.crypto.randomUUID();
}
function mergeMessages(
  current: readonly DashboardMessage[],
  incoming: readonly DashboardMessage[],
) {
  const result = [...current];
  for (const message of incoming) {
    const index = result.findIndex(
      (item) =>
        item.id === message.id ||
        (message.clientMessageId &&
          item.clientMessageId === message.clientMessageId),
    );
    if (index >= 0) result[index] = message;
    else result.push(message);
  }
  return result.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
function text(element: Element, value: string) {
  element.textContent = value;
}
function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

export class SupportDashboardController {
  readonly #options;
  readonly #http;
  readonly #listeners = new Map<
    SupportDashboardEventName,
    Set<SupportDashboardListener>
  >();
  #socket?: Socket;
  #session: DashboardAgentSession["actor"] | undefined;
  #conversations: DashboardConversation[] = [];
  #messages: DashboardMessage[] = [];
  #active: string | undefined;
  #connection: Connection = "connecting";
  #hasConnected = false;
  #mode: Mode = "reply";
  #destroyed = false;
  #initialized = false;
  #seenEvents = new Set<string>();
  #drafts = new Map<string, string>();
  #uploads = new Map<string, PendingUpload[]>();
  #attachmentConfig: z.infer<typeof attachmentConfigSchema>["attachments"];
  #filters: SupportDashboardFilters;
  #root: HTMLDivElement;
  #media?: MediaQueryList;
  #mediaListener?: () => void;
  #typingTimer: ReturnType<typeof setTimeout> | undefined;
  #typingSent = false;
  #customerTyping = false;
  #readMessageIds = new Set<string>();
  #detailSequence = 0;
  #announcement = "";
  #focusedConversationId: string | undefined;
  #knowledgeMode = false;
  #knowledgeArticles: PublicKnowledgeArticle[] = [];
  readonly #onRootClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const conversation = target.closest<HTMLElement>("[data-conversation]");
    if (conversation?.dataset.conversation)
      void this.openConversation(conversation.dataset.conversation);
  };
  readonly #onRootFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    this.#focusedConversationId =
      target instanceof Element
        ? target.closest<HTMLElement>("[data-conversation]")?.dataset
            .conversation
        : undefined;
  };
  readonly #onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || !this.#focusedConversationId) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target !== document.body &&
      !this.#root.contains(target)
    )
      return;
    const conversationId = this.#focusedConversationId;
    this.#focusedConversationId = undefined;
    event.preventDefault();
    void this.openConversation(conversationId);
  };
  constructor(options: SupportDashboardOptions) {
    this.#options = resolveDashboardOptions(options);
    this.#filters = this.#options.initialFilters ?? {};
    this.#http = new DashboardHttpClient(
      this.#options.apiBaseUrl,
      this.#options.credentials,
      this.#options.requestTimeoutMs,
    );
    this.#root = document.createElement("div");
    this.#root.className = "sk-dashboard";
    this.#root.style.setProperty("--sk-accent", this.#options.accentColor);
    this.#options.target.replaceChildren(this.#root);
    this.#root.addEventListener("click", this.#onRootClick);
    this.#root.addEventListener("focusin", this.#onRootFocusIn);
    document.addEventListener("keydown", this.#onDocumentKeydown, true);
    this.#applyTheme();
  }
  async initialize() {
    if (this.#initialized || this.#destroyed) return;
    this.#initialized = true;
    this.#renderLoading();
    try {
      try {
        const configuration = attachmentConfigSchema.parse(
          await this.#http.request<unknown>("/widget/config"),
        );
        this.#attachmentConfig = configuration.features.attachments
          ? configuration.attachments
          : undefined;
      } catch {
        this.#attachmentConfig = undefined;
      }
      await this.#resolveSession();
      if (!this.#has("conversation.read") && !this.#has("knowledge.read")) {
        this.#renderUnauthorized();
        return;
      }
      if (!this.#has("conversation.read")) {
        await this.#openKnowledge();
        this.#emit("ready");
        return;
      }
      if (!this.#has("conversation.reply") && this.#has("internal_note.create"))
        this.#mode = "note";
      await this.refreshInbox();
      this.#connect();
      this.#emit("ready");
    } catch (error) {
      this.#renderError(error);
    }
  }
  async refreshInbox(render = true) {
    if (this.#destroyed) return;
    const query =
      this.#filters.assignment === "mine" && this.#session
        ? "?assignment=mine"
        : "";
    let data: unknown[];
    try {
      data = await this.#http.request<unknown[]>(
        `/agent/conversations${query}`,
      );
    } catch (error) {
      if (error instanceof DashboardHttpError && error.kind === "auth") {
        this.#clearPrivateState();
        this.#renderUnauthorized();
        return;
      }
      throw error;
    }
    this.#conversations = data
      .map((item) => dashboardConversationSchema.parse(item))
      .filter(
        (item) => !this.#filters.status || item.status === this.#filters.status,
      );
    if (render) {
      if (!this.#active && this.#root.querySelector(".sk-inbox"))
        this.#renderInboxList();
      else this.#render();
    }
  }
  async openConversation(conversationId: string) {
    if (this.#destroyed) return;
    const previous = this.#active;
    if (previous && previous !== conversationId)
      this.#socket?.emit("conversation.leave", { conversationId: previous });
    this.#active = conversationId;
    const sequence = ++this.#detailSequence;
    this.#render();
    let rawDetail: unknown;
    try {
      rawDetail = await this.#http.request<unknown>(
        `/agent/conversations/${encodeURIComponent(conversationId)}`,
      );
    } catch (error) {
      if (error instanceof DashboardHttpError && error.kind === "auth") {
        this.#clearPrivateState();
        this.#renderUnauthorized();
        return;
      }
      throw error;
    }
    const detail = dashboardConversationDetailSchema.parse(rawDetail);
    if (this.#active !== conversationId || sequence !== this.#detailSequence)
      return;
    this.#messages = mergeMessages(
      [],
      detail.messages.filter(
        (message) =>
          message.type !== "internal_note" || this.#has("internal_note.read"),
      ),
    );
    this.#socket?.emit("conversation.join", { conversationId });
    this.#render();
    if (globalThis.innerWidth <= 680)
      this.#root.querySelector<HTMLElement>('[data-action="back"]')?.focus();
    this.#emit("conversation.opened", { conversationId });
    await this.#recordReads();
  }
  closeConversation() {
    const previous = this.#active;
    this.#stopTyping();
    if (this.#active)
      this.#socket?.emit("conversation.leave", {
        conversationId: this.#active,
      });
    this.#active = undefined;
    this.#detailSequence += 1;
    this.#messages = [];
    this.#render();
    if (previous)
      this.#root
        .querySelector<HTMLElement>(
          `[data-conversation="${CSS.escape(previous)}"]`,
        )
        ?.focus();
  }
  setFilters(filters: SupportDashboardFilters) {
    this.#filters = filters;
    void this.refreshInbox();
  }
  clearFilters() {
    this.setFilters({});
  }
  on(name: SupportDashboardEventName, listener: SupportDashboardListener) {
    const set = this.#listeners.get(name) ?? new Set();
    set.add(listener);
    this.#listeners.set(name, set);
    return () => this.off(name, listener);
  }
  off(name: SupportDashboardEventName, listener: SupportDashboardListener) {
    this.#listeners.get(name)?.delete(listener);
  }
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#stopTyping();
    this.#http.dispose();
    this.#socket?.removeAllListeners();
    this.#socket?.disconnect();
    this.#root.removeEventListener("click", this.#onRootClick);
    this.#root.removeEventListener("focusin", this.#onRootFocusIn);
    document.removeEventListener("keydown", this.#onDocumentKeydown, true);
    for (const uploads of this.#uploads.values())
      for (const upload of uploads) upload.handle?.cancel();
    if (this.#media && this.#mediaListener)
      this.#media.removeEventListener("change", this.#mediaListener);
    this.#listeners.clear();
    this.#session = undefined;
    this.#conversations = [];
    this.#messages = [];
    this.#drafts.clear();
    this.#uploads.clear();
    this.#seenEvents.clear();
    this.#readMessageIds.clear();
    this.#active = undefined;
    this.#options.target.replaceChildren();
  }
  #has(permission: string) {
    return this.#session?.permissions.includes(permission as never) === true;
  }
  #clearPrivateState() {
    this.#stopTyping(false);
    this.#session = undefined;
    this.#active = undefined;
    this.#conversations = [];
    this.#messages = [];
    this.#drafts.clear();
    for (const uploads of this.#uploads.values())
      for (const upload of uploads) upload.handle?.cancel();
    this.#uploads.clear();
    this.#seenEvents.clear();
    this.#readMessageIds.clear();
    this.#customerTyping = false;
    this.#detailSequence += 1;
  }
  async #resolveSession(): Promise<boolean> {
    const rawSession = await this.#http.request<unknown>("/agent/session", {
      method: "POST",
    });
    const next = dashboardAgentSessionSchema.parse(rawSession).actor;
    const identityChanged = Boolean(
      this.#session && this.#session.id !== next.id,
    );
    if (identityChanged) {
      this.#clearPrivateState();
    }
    this.#session = next;
    return identityChanged;
  }
  #emit(type: SupportDashboardEventName, data?: unknown) {
    const event: SupportDashboardEvent = {
      type,
      ...(data === undefined ? {} : { data }),
    };
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
  #applyTheme() {
    const apply = () => {
      const dark =
        this.#options.theme === "dark" ||
        (this.#options.theme === "system" &&
          matchMedia("(prefers-color-scheme: dark)").matches);
      this.#root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (this.#options.theme === "system") {
      this.#media = matchMedia("(prefers-color-scheme: dark)");
      this.#mediaListener = apply;
      this.#media.addEventListener("change", apply);
    }
  }
  #connect() {
    this.#socket = io(this.#options.socketUrl, {
      autoConnect: false,
      withCredentials: this.#options.credentials !== "omit",
      auth: { actorType: "agent" },
    });
    this.#socket.on("connect", () => {
      const reconnect = this.#hasConnected;
      this.#hasConnected = true;
      this.#connection = "connected";
      this.#renderConnectionState();
      if (!reconnect && this.#active)
        this.#socket?.emit("conversation.join", {
          conversationId: this.#active,
        });
      if (reconnect) void this.#reauthorizeAndResync();
      this.#emit("connection.changed", { state: this.#connection });
    });
    this.#socket.on("disconnect", () => {
      this.#stopTyping(false);
      this.#customerTyping = false;
      this.#connection = navigator.onLine ? "reconnecting" : "offline";
      this.#renderConnectionState();
      this.#emit("connection.changed", { state: this.#connection });
    });
    this.#socket.on("connect_error", () => {
      this.#stopTyping(false);
      this.#customerTyping = false;
      this.#connection = "offline";
      this.#renderConnectionState();
      this.#emit("connection.changed", { state: this.#connection });
    });
    for (const name of [
      "message.created",
      "internal_note.created",
      "conversation.updated",
      "conversation.assigned",
      "conversation.status_changed",
      "conversation.tag_added",
      "conversation.tag_removed",
    ] as const)
      this.#socket.on(name, (value) => void this.#event(value));
    this.#socket.on("typing.updated", (value) => {
      const parsed = dashboardSocketEventEnvelopeSchema.safeParse(value);
      if (
        !parsed.success ||
        parsed.data.conversationId !== this.#active ||
        typeof parsed.data.data !== "object" ||
        parsed.data.data === null
      )
        return;
      const data = parsed.data.data as {
        actor?: { type?: string };
        active?: boolean;
      };
      if (data.actor?.type === "customer" || data.actor?.type === "visitor") {
        this.#customerTyping = data.active === true;
        this.#renderConnectionState();
      }
    });
    this.#socket.connect();
  }
  async #event(value: unknown) {
    const parsed = dashboardSocketEventEnvelopeSchema.safeParse(value);
    if (!parsed.success || this.#seenEvents.has(parsed.data.eventId)) return;
    this.#seenEvents.add(parsed.data.eventId);
    if (this.#seenEvents.size > 500)
      this.#seenEvents.delete(this.#seenEvents.values().next().value as string);
    if (
      parsed.data.eventType === "internal_note.created" &&
      !this.#has("internal_note.read")
    )
      return;
    if (
      ["message.created", "internal_note.created"].includes(
        parsed.data.eventType,
      )
    ) {
      const message = dashboardMessageSchema.safeParse(parsed.data.data);
      if (message.success && message.data.conversationId === this.#active) {
        this.#messages = mergeMessages(this.#messages, [message.data]);
        this.#announcement =
          message.data.type === "internal_note"
            ? "New internal note"
            : "New conversation message";
        this.#render();
        this.#emit("message.received", {
          conversationId: message.data.conversationId,
        });
        return;
      }
    }
    await this.#resync();
  }
  async #resync(renderInbox = true) {
    await this.refreshInbox(renderInbox);
    if (this.#active) {
      const active = this.#active;
      const detail = dashboardConversationDetailSchema.parse(
        await this.#http.request<unknown>(
          `/agent/conversations/${encodeURIComponent(active)}`,
        ),
      );
      this.#messages = mergeMessages(
        this.#messages,
        detail.messages.filter(
          (m) => m.type !== "internal_note" || this.#has("internal_note.read"),
        ),
      );
      this.#render();
    }
  }
  async #reauthorizeAndResync() {
    try {
      const identityChanged = await this.#resolveSession();
      if (!this.#has("conversation.read")) {
        this.#renderUnauthorized();
        return;
      }
      if (this.#active)
        this.#socket?.emit("conversation.join", {
          conversationId: this.#active,
        });
      await this.#resync(identityChanged);
      if (identityChanged) this.#render();
    } catch (error) {
      this.#clearPrivateState();
      this.#renderError(error);
    }
  }
  async #recordReads() {
    if (!this.#active || document.visibilityState === "hidden") return;
    for (const message of this.#messages.filter(
      (m) => m.senderType !== "agent" && !this.#readMessageIds.has(m.id),
    ))
      await this.#http
        .request(`/agent/messages/${encodeURIComponent(message.id)}/read`, {
          method: "POST",
        })
        .then(() => this.#readMessageIds.add(message.id))
        .catch(() => undefined);
  }
  #startTyping() {
    if (!this.#active) return;
    if (!this.#typingSent) {
      this.#socket?.emit("typing.start", { conversationId: this.#active });
      this.#typingSent = true;
    }
    if (this.#typingTimer) clearTimeout(this.#typingTimer);
    this.#typingTimer = setTimeout(() => this.#stopTyping(), 2_000);
  }
  #stopTyping(emit = true) {
    if (this.#typingTimer) clearTimeout(this.#typingTimer);
    this.#typingTimer = undefined;
    if (emit && this.#typingSent && this.#active)
      this.#socket?.emit("typing.stop", { conversationId: this.#active });
    this.#typingSent = false;
  }
  async #send() {
    if (!this.#active) return;
    if (this.#mode === "reply" && !this.#has("conversation.reply")) return;
    if (this.#mode === "note" && !this.#has("internal_note.create")) return;
    this.#stopTyping();
    const key = `${this.#active}:${this.#mode}`;
    const body = this.#drafts.get(key)?.trim();
    const uploads = this.#uploads.get(key) ?? [];
    const attachmentIds = uploads.flatMap((upload) =>
      upload.status === "ready" && upload.attachmentId
        ? [upload.attachmentId]
        : [],
    );
    if (
      (!body && attachmentIds.length === 0) ||
      uploads.some((upload) => upload.status === "uploading")
    )
      return;
    const clientMessageId = id();
    const optimistic = dashboardMessageSchema.parse({
      id: `pending-${clientMessageId}`,
      conversationId: this.#active,
      clientMessageId,
      type: this.#mode === "note" ? "internal_note" : "text",
      senderType: "agent",
      body: body ?? "",
      attachments: uploads.flatMap((upload) =>
        upload.status === "ready" && upload.attachmentId
          ? [
              {
                id: upload.attachmentId,
                fileName: upload.file.name,
                mediaType: upload.file.type,
                sizeBytes: upload.file.size,
                status: "ready" as const,
              },
            ]
          : [],
      ),
      deliveryStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.#messages = mergeMessages(this.#messages, [optimistic]);
    this.#render();
    const route = this.#mode === "note" ? "notes" : "messages";
    try {
      const sent = dashboardMessageSchema.parse(
        await this.#http.request<unknown>(
          `/agent/conversations/${encodeURIComponent(this.#active)}/${route}`,
          {
            method: "POST",
            body: JSON.stringify({
              body: body ?? "",
              clientMessageId,
              attachmentIds,
            }),
          },
        ),
      );
      this.#messages = mergeMessages(this.#messages, [sent]);
      this.#drafts.delete(key);
      this.#uploads.delete(key);
      this.#render();
      this.#emit("message.sent", { conversationId: this.#active });
    } catch (error) {
      if (error instanceof DashboardHttpError && error.kind === "auth") {
        this.#clearPrivateState();
        this.#renderUnauthorized();
        return;
      }
      const index = this.#messages.findIndex(
        (m) => m.clientMessageId === clientMessageId,
      );
      if (index >= 0)
        this.#messages[index] = {
          ...this.#messages[index]!,
          deliveryStatus: "failed",
        };
      this.#render();
      this.#emit("error", {
        message: error instanceof Error ? error.message : "Message failed.",
      });
    }
  }
  async #retry(clientMessageId: string) {
    const failed = this.#messages.find(
      (message) =>
        message.clientMessageId === clientMessageId &&
        message.deliveryStatus === "failed",
    );
    if (!failed || !this.#active || failed.conversationId !== this.#active)
      return;
    const route = failed.type === "internal_note" ? "notes" : "messages";
    if (route === "notes" && !this.#has("internal_note.create")) return;
    if (route === "messages" && !this.#has("conversation.reply")) return;
    const pending = { ...failed, deliveryStatus: "pending" as const };
    this.#messages = mergeMessages(this.#messages, [pending]);
    this.#render();
    try {
      const sent = dashboardMessageSchema.parse(
        await this.#http.request<unknown>(
          `/agent/conversations/${encodeURIComponent(this.#active)}/${route}`,
          {
            method: "POST",
            body: JSON.stringify({
              body: failed.body,
              clientMessageId,
              attachmentIds: (failed.attachments ?? []).map(
                (attachment) => attachment.id,
              ),
            }),
          },
        ),
      );
      this.#messages = mergeMessages(this.#messages, [sent]);
      this.#render();
    } catch (error) {
      if (error instanceof DashboardHttpError && error.kind === "auth") {
        this.#clearPrivateState();
        this.#renderUnauthorized();
        return;
      }
      this.#messages = mergeMessages(this.#messages, [failed]);
      this.#render();
    }
  }
  #uploadKey(): string | undefined {
    return this.#active ? `${this.#active}:${this.#mode}` : undefined;
  }
  #selectFiles(files: FileList | null): void {
    const key = this.#uploadKey();
    if (!key || !files || !this.#attachmentConfig) return;
    const queue = this.#uploads.get(key) ?? [];
    const remaining = this.#attachmentConfig.maxFilesPerMessage - queue.length;
    for (const file of [...files].slice(0, Math.max(0, remaining))) {
      const upload: PendingUpload = {
        localId: id(),
        file,
        status: "uploading",
        progress: 0,
      };
      if (file.size > this.#attachmentConfig.maxFileSizeBytes) {
        upload.status = "failed";
        upload.error = "File is too large.";
      } else if (!this.#attachmentConfig.allowedMimeTypes.includes(file.type)) {
        upload.status = "failed";
        upload.error = "File type is not allowed.";
      }
      queue.push(upload);
      if (upload.status === "uploading") void this.#upload(key, upload);
    }
    this.#uploads.set(key, queue);
    this.#render();
  }
  async #upload(key: string, upload: PendingUpload) {
    const [conversationId] = key.split(":");
    if (!conversationId) return;
    upload.status = "uploading";
    upload.progress = 0;
    delete upload.error;
    this.#render();
    try {
      const intent = uploadIntentSchema.parse(
        await this.#http.request<unknown>("/agent/attachments/upload-intents", {
          method: "POST",
          body: JSON.stringify({
            conversationId,
            fileName: upload.file.name,
            mimeType: upload.file.type,
            sizeBytes: upload.file.size,
            purpose: key.endsWith(":note") ? "internal_note" : "reply",
          }),
        }),
      );
      if (this.#destroyed || !this.#uploads.get(key)?.includes(upload)) return;
      upload.attachmentId = intent.attachment.id;
      upload.handle = uploadToPresignedTarget(
        intent.upload,
        upload.file,
        (progress) => {
          if (!this.#destroyed && this.#uploads.get(key)?.includes(upload)) {
            upload.progress = progress;
            this.#render();
          }
        },
      );
      await upload.handle.completed;
      attachmentSchema.parse(
        await this.#http.request<unknown>(
          `/agent/attachments/${encodeURIComponent(intent.attachment.id)}/complete?conversationId=${encodeURIComponent(conversationId)}`,
          { method: "POST", body: "{}" },
        ),
      );
      if (!this.#uploads.get(key)?.includes(upload)) return;
      upload.status = "ready";
      upload.progress = 100;
      delete upload.handle;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        upload.status = "failed";
        upload.error =
          error instanceof Error ? error.message : "Upload failed.";
      }
      delete upload.handle;
    }
    this.#render();
  }
  async #removeUpload(localId: string) {
    const key = this.#uploadKey();
    if (!key) return;
    const queue = this.#uploads.get(key) ?? [];
    const upload = queue.find((item) => item.localId === localId);
    if (!upload) return;
    upload.status = "cancelled";
    upload.handle?.cancel();
    this.#uploads.set(
      key,
      queue.filter((item) => item !== upload),
    );
    if (upload.attachmentId && this.#active) {
      try {
        await this.#http.request(
          `/agent/attachments/${encodeURIComponent(upload.attachmentId)}?conversationId=${encodeURIComponent(this.#active)}`,
          { method: "DELETE" },
        );
      } catch {
        /* pending file stays server-side and unusable */
      }
    }
    this.#render();
  }
  async #retryUpload(localId: string) {
    const key = this.#uploadKey();
    const upload = key
      ? this.#uploads.get(key)?.find((item) => item.localId === localId)
      : undefined;
    if (!key || !upload) return;
    delete upload.attachmentId;
    await this.#upload(key, upload);
  }
  async #download(attachmentId: string) {
    if (!this.#active) return;
    const result = z
      .strictObject({ url: z.url(), expiresAt: z.string() })
      .parse(
        await this.#http.request<unknown>(
          `/agent/attachments/${encodeURIComponent(attachmentId)}/download?conversationId=${encodeURIComponent(this.#active)}`,
        ),
      );
    const link = document.createElement("a");
    link.href = result.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }
  async #action(action: "assign" | "resolve" | "reopen" | "spam") {
    if (!this.#active || !this.#session) return;
    const route = action === "assign" ? "assign-self" : action;
    try {
      await this.#http.request(
        `/agent/conversations/${encodeURIComponent(this.#active)}/${route}`,
        { method: "POST" },
      );
      await this.#resync();
    } catch (error) {
      if (error instanceof DashboardHttpError && error.kind === "auth") {
        this.#clearPrivateState();
        this.#renderUnauthorized();
        return;
      }
      this.#announcement =
        error instanceof Error
          ? error.message
          : "The action could not be completed.";
      this.#render();
      this.#emit("error", { message: this.#announcement });
    }
  }
  #renderLoading() {
    this.#root.innerHTML = `<style>${css}</style><div class="sk-state" role="status">${this.#options.strings.loading}</div>`;
  }
  #renderUnauthorized() {
    this.#root.innerHTML = `<style>${css}</style><div class="sk-state" role="alert">${this.#options.strings.unauthorized}</div>`;
  }
  #renderError(error: unknown) {
    const message =
      error instanceof DashboardHttpError && error.kind === "auth"
        ? this.#options.strings.unauthorized
        : error instanceof Error
          ? error.message
          : "The dashboard could not load.";
    this.#root.innerHTML = `<style>${css}</style><div class="sk-state" role="alert"></div>`;
    text(this.#root.querySelector(".sk-state")!, message);
    this.#emit("error", { message });
  }
  #connectionText(): string {
    if (this.#connection === "connected") {
      if (this.#customerTyping) return "Customer is typing…";
      const active = this.#conversations.find(
        (conversation) => conversation.id === this.#active,
      );
      return active?.status.replaceAll("_", " ") ?? "Connected";
    }
    return this.#connection === "offline"
      ? this.#options.strings.offline
      : this.#options.strings.reconnecting;
  }
  #renderConnectionState(): void {
    if (this.#destroyed) return;
    const status = this.#root.querySelector<HTMLElement>(
      "[data-connection-status]",
    );
    if (status) status.textContent = this.#connectionText();
    const announcement = this.#root.querySelector<HTMLElement>(
      "[data-connection-announcement]",
    );
    if (announcement)
      announcement.textContent =
        this.#connection === "connected" ? "Connected" : this.#connectionText();
  }
  #renderInboxList(): void {
    const list = this.#root.querySelector<HTMLUListElement>(".sk-inbox");
    if (!list) return;
    const existing = new Map(
      [...list.querySelectorAll<HTMLButtonElement>("[data-conversation]")].map(
        (button) => [button.dataset.conversation, button] as const,
      ),
    );
    if (!this.#conversations.length) {
      list.replaceChildren();
      const empty = document.createElement("li");
      empty.className = "sk-state";
      empty.textContent = this.#options.strings.noConversations;
      list.append(empty);
      return;
    }
    list.querySelector(".sk-state")?.remove();
    for (const conversation of this.#conversations) {
      let button = existing.get(conversation.id);
      if (!button) {
        const item = document.createElement("li");
        button = document.createElement("button");
        button.className = "sk-item";
        button.dataset.conversation = conversation.id;
        button.append(
          document.createElement("strong"),
          document.createElement("span"),
        );
        button.lastElementChild?.classList.add("sk-meta");
        item.append(button);
      }
      button.setAttribute(
        "aria-current",
        String(conversation.id === this.#active),
      );
      text(
        button.querySelector("strong")!,
        conversation.subject ?? "Support conversation",
      );
      text(
        button.querySelector(".sk-meta")!,
        `${conversation.status.replaceAll("_", " ")} · ${new Date(conversation.updatedAt).toLocaleString()}`,
      );
      list.append(button.parentElement!);
      existing.delete(conversation.id);
    }
    for (const button of existing.values()) button.parentElement?.remove();
  }
  async #openKnowledge(): Promise<void> {
    if (!this.#has("knowledge.read")) return;
    try {
      this.#knowledgeArticles = publicKnowledgeArticleSchema
        .array()
        .parse(await this.#http.request<unknown>("/agent/knowledge"));
      this.#knowledgeMode = true;
      this.#render();
    } catch (error) {
      this.#renderError(error);
    }
  }
  #renderKnowledge(): void {
    this.#root.dataset.mobileView = "inbox";
    this.#root.innerHTML = `<style>${css}</style><section class="sk-panel" style="grid-column:1/-1" aria-label="Knowledge base"><header class="sk-head"><button class="sk-btn" data-action="knowledge-back">${this.#options.strings.back}</button><h1>Knowledge base</h1>${this.#has("knowledge.manage") ? `<button class="sk-btn sk-btn-primary" data-action="knowledge-new">New article</button>` : ""}</header><div class="sk-detail"><div class="sk-knowledge-list"></div><form class="sk-knowledge-form" hidden><label>Title<input class="sk-compose" name="title" maxlength="200" required></label><label>Source key<input class="sk-compose" name="sourceKey" maxlength="128" required pattern="[a-z0-9-]+"></label><label>Summary<textarea class="sk-compose" name="summary" maxlength="1000"></textarea></label><label>Article body<textarea class="sk-compose" name="body" maxlength="200000" required></textarea></label><button class="sk-btn sk-btn-primary" type="submit">Save draft</button></form></div><div class="sk-visually-hidden" aria-live="polite">${this.#announcement}</div></section>`;
    const list = this.#root.querySelector<HTMLElement>(".sk-knowledge-list");
    if (list) {
      if (!this.#knowledgeArticles.length)
        list.textContent = "No knowledge articles.";
      for (const article of this.#knowledgeArticles) {
        const card = document.createElement("article");
        card.className = "sk-item";
        const title = document.createElement("strong");
        title.textContent = article.title;
        const meta = document.createElement("p");
        meta.className = "sk-meta";
        meta.textContent = `${article.status} · revision ${article.revisionNumber} · ${article.sourceKey}`;
        const summary = document.createElement("p");
        summary.textContent = article.summary;
        card.append(title, meta, summary);
        if (this.#has("knowledge.manage")) {
          const action = document.createElement("button");
          action.className = "sk-btn";
          action.dataset.knowledgeAction =
            article.status === "published"
              ? "archive"
              : article.status === "archived"
                ? "restore"
                : "publish";
          action.dataset.articleId = article.id;
          action.textContent = action.dataset.knowledgeAction;
          card.append(action);
        }
        list.append(card);
      }
    }
    this.#root
      .querySelector('[data-action="knowledge-back"]')
      ?.addEventListener("click", () => {
        this.#knowledgeMode = false;
        this.#render();
      });
    this.#root
      .querySelector('[data-action="knowledge-new"]')
      ?.addEventListener("click", () => {
        const form =
          this.#root.querySelector<HTMLFormElement>(".sk-knowledge-form");
        if (form) {
          form.hidden = false;
          form.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
        }
      });
    this.#root
      .querySelector<HTMLFormElement>(".sk-knowledge-form")
      ?.addEventListener(
        "submit",
        (event) => void this.#createKnowledge(event),
      );
    this.#root
      .querySelectorAll<HTMLElement>("[data-knowledge-action]")
      .forEach((element) =>
        element.addEventListener(
          "click",
          () => void this.#knowledgeAction(element),
        ),
      );
  }
  async #createKnowledge(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!this.#has("knowledge.manage")) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    try {
      await this.#http.request("/agent/knowledge", {
        method: "POST",
        body: JSON.stringify({
          title: formText(data, "title"),
          sourceKey: formText(data, "sourceKey"),
          summary: formText(data, "summary"),
          body: formText(data, "body"),
          tags: [],
        }),
      });
      await this.#openKnowledge();
    } catch (error) {
      this.#renderError(error);
    }
  }
  async #knowledgeAction(element: HTMLElement): Promise<void> {
    if (!this.#has("knowledge.manage")) return;
    const articleId = element.dataset.articleId;
    const action = element.dataset.knowledgeAction;
    if (!articleId || !action) return;
    try {
      await this.#http.request(
        `/agent/knowledge/${encodeURIComponent(articleId)}/${action}`,
        { method: "POST", body: "{}" },
      );
      await this.#openKnowledge();
    } catch (error) {
      this.#renderError(error);
    }
  }
  #render() {
    if (!this.#session || this.#destroyed) return;
    if (this.#knowledgeMode) {
      this.#renderKnowledge();
      return;
    }
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.action
        : undefined;
    this.#root.dataset.mobileView = this.#active ? "conversation" : "inbox";
    this.#root.innerHTML = `<style>${css}</style><section class="sk-panel sk-inbox-panel" aria-label="${this.#options.strings.inbox}"><header class="sk-head"><h1>${this.#options.strings.inbox}</h1>${this.#has("knowledge.read") ? `<button class="sk-btn" data-action="knowledge">Knowledge</button>` : ""}<button class="sk-btn" data-action="refresh">${this.#options.strings.refresh}</button></header><div class="sk-head sk-controls"><select class="sk-select" data-action="assignment" aria-label="Assignment filter"><option value="all">${this.#options.strings.allConversations}</option><option value="mine">${this.#options.strings.assignedToMe}</option></select><select class="sk-select" data-action="status" aria-label="Status filter"><option value="">All statuses</option>${["open", "waiting_for_agent", "waiting_for_customer", "resolved", "closed", "spam"].map((s) => `<option value="${s}">${s.replaceAll("_", " ")}</option>`).join("")}</select></div><ul class="sk-inbox"></ul></section><main class="sk-panel sk-conversation" aria-label="Conversation workspace"></main><aside class="sk-panel sk-context" aria-label="${this.#options.strings.customerDetails}"></aside><div class="sk-visually-hidden" data-connection-announcement aria-live="polite" aria-atomic="true">${this.#announcement || (this.#connection === "connected" ? "Connected" : this.#options.strings.reconnecting)}</div>`;
    this.#renderInboxList();
    const center = this.#root.querySelector(".sk-conversation")!;
    const active = this.#conversations.find((c) => c.id === this.#active);
    if (!active)
      center.innerHTML = `<div class="sk-state">${this.#options.strings.selectConversation}</div>`;
    else {
      const liveStatus =
        this.#connection === "connected"
          ? this.#customerTyping
            ? "Customer is typing…"
            : active.status.replaceAll("_", " ")
          : this.#options.strings.offline;
      const canReply = this.#has("conversation.reply");
      const canNote = this.#has("internal_note.create");
      const composer =
        canReply || canNote
          ? `<div class="sk-compose-wrap"><div class="sk-compose-actions">${canReply ? `<button class="sk-btn" data-action="reply" aria-pressed="${String(this.#mode === "reply")}">${this.#options.strings.reply}</button>` : ""}${canNote ? `<button class="sk-btn sk-btn-note" data-action="note" aria-pressed="${String(this.#mode === "note")}">${this.#options.strings.internalNote}</button>` : ""}${this.#attachmentConfig ? `<input class="sk-file-input" type="file" multiple><button class="sk-btn" data-action="attach" aria-label="Attach files">Attach</button>` : ""}<button class="sk-btn sk-btn-primary sk-send" data-action="send">${this.#options.strings.send}</button></div><div class="sk-files sk-upload-queue" role="status" aria-label="Selected attachments"></div><label class="sk-visually-hidden" for="sk-composer">${this.#mode === "note" ? this.#options.strings.internalNote : this.#options.strings.reply}</label><textarea id="sk-composer" class="sk-compose" maxlength="50000"></textarea></div>`
          : `<div class="sk-live" role="status">Read-only access</div>`;
      center.innerHTML = `<header class="sk-head"><button class="sk-btn sk-back" data-action="back">${this.#options.strings.back}</button><h2></h2><div class="sk-controls"></div></header><div class="sk-live" data-connection-status role="status">${liveStatus}</div><div class="sk-timeline" aria-label="Conversation messages"></div>${composer}`;
      text(
        center.querySelector("h2")!,
        active.subject ?? "Support conversation",
      );
      const controls = center.querySelector(".sk-controls")!;
      if (this.#has("conversation.assign"))
        controls.insertAdjacentHTML(
          "beforeend",
          `<button class="sk-btn" data-action="assign">${this.#options.strings.assignToMe}</button>`,
        );
      if (active.status === "resolved" && this.#has("conversation.reopen"))
        controls.insertAdjacentHTML(
          "beforeend",
          `<button class="sk-btn" data-action="reopen">${this.#options.strings.reopen}</button>`,
        );
      else if (this.#has("conversation.close"))
        controls.insertAdjacentHTML(
          "beforeend",
          `<button class="sk-btn" data-action="resolve">${this.#options.strings.resolve}</button>`,
        );
      if (this.#has("conversation.mark_spam"))
        controls.insertAdjacentHTML(
          "beforeend",
          `<button class="sk-btn" data-action="spam">${this.#options.strings.markSpam}</button>`,
        );
      const timeline = center.querySelector(".sk-timeline")!;
      for (const message of this.#messages) {
        const article = document.createElement("article");
        article.className = `sk-message ${message.senderType === "agent" ? "sk-message-agent" : ""} ${message.type === "internal_note" ? "sk-message-note" : ""}`;
        article.setAttribute(
          "aria-label",
          message.type === "internal_note"
            ? "Internal note"
            : `${message.senderType} message`,
        );
        const body = document.createElement("div");
        body.textContent = message.body;
        article.append(body);
        if (message.attachments?.length) {
          const files = document.createElement("div");
          files.className = "sk-files";
          for (const attachment of message.attachments) {
            const card = document.createElement("div");
            card.className = `sk-file ${message.type === "internal_note" ? "sk-file-note" : ""}`;
            const name = document.createElement("span");
            name.textContent = attachment.fileName;
            const download = document.createElement("button");
            download.className = "sk-btn";
            download.dataset.download = attachment.id;
            download.textContent = "Download";
            download.setAttribute(
              "aria-label",
              `Download ${attachment.fileName}`,
            );
            card.append(name, download);
            files.append(card);
          }
          article.append(files);
        }
        if (message.deliveryStatus === "failed") {
          const failed = document.createElement("span");
          failed.className = "sk-meta";
          failed.textContent = "Message failed";
          article.append(failed);
          if (message.clientMessageId) {
            const retry = document.createElement("button");
            retry.className = "sk-btn";
            retry.dataset.retry = message.clientMessageId;
            retry.textContent = this.#options.strings.retry;
            article.append(retry);
          }
        }
        timeline.append(article);
      }
      const textarea = center.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea)
        textarea.value =
          this.#drafts.get(`${this.#active}:${this.#mode}`) ?? "";
      const queue = center.querySelector(".sk-upload-queue");
      const uploadKey = `${this.#active}:${this.#mode}`;
      for (const upload of this.#uploads.get(uploadKey) ?? []) {
        const card = document.createElement("div");
        card.className = `sk-file ${this.#mode === "note" ? "sk-file-note" : ""}`;
        const name = document.createElement("span");
        name.textContent = `${upload.file.name} (${Math.ceil(upload.file.size / 1024)} KB)`;
        card.append(name);
        if (upload.status === "uploading") {
          const progress = document.createElement("progress");
          progress.max = 100;
          progress.value = upload.progress;
          progress.setAttribute(
            "aria-label",
            `Uploading ${upload.file.name}: ${upload.progress}%`,
          );
          card.append(progress);
        } else if (upload.status === "failed") {
          const error = document.createElement("span");
          error.setAttribute("role", "alert");
          error.textContent = upload.error ?? "Upload failed.";
          const retry = document.createElement("button");
          retry.className = "sk-btn";
          retry.dataset.retryUpload = upload.localId;
          retry.textContent = "Retry";
          card.append(error, retry);
        } else {
          const ready = document.createElement("span");
          ready.textContent = "Ready";
          card.append(ready);
        }
        const remove = document.createElement("button");
        remove.className = "sk-btn";
        remove.dataset.removeUpload = upload.localId;
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove ${upload.file.name}`);
        card.append(remove);
        queue?.append(card);
      }
    }
    const context = this.#root.querySelector(".sk-context")!;
    context.innerHTML = `<header class="sk-head"><h2>${this.#options.strings.customerDetails}</h2></header><div class="sk-detail"><dl><dt>Participant details</dt><dd>Unavailable from the current public server contract</dd><dt>Conversation status</dt><dd>${active?.status.replaceAll("_", " ") ?? "—"}</dd><dt>Created</dt><dd>${active ? new Date(active.createdAt).toLocaleString() : "—"}</dd></dl></div>`;
    (
      this.#root.querySelector(
        '[data-action="assignment"]',
      ) as HTMLSelectElement
    ).value = this.#filters.assignment ?? "all";
    (
      this.#root.querySelector('[data-action="status"]') as HTMLSelectElement
    ).value = this.#filters.status ?? "";
    this.#bind();
    if (focused)
      this.#root
        .querySelector<HTMLElement>(`[data-action="${focused}"]`)
        ?.focus();
  }
  #bind() {
    this.#root
      .querySelectorAll<HTMLElement>("[data-download]")
      .forEach((element) =>
        element.addEventListener("click", () => {
          if (element.dataset.download)
            void this.#download(element.dataset.download);
        }),
      );
    this.#root
      .querySelectorAll<HTMLElement>("[data-remove-upload]")
      .forEach((element) =>
        element.addEventListener("click", () => {
          if (element.dataset.removeUpload)
            void this.#removeUpload(element.dataset.removeUpload);
        }),
      );
    this.#root
      .querySelectorAll<HTMLElement>("[data-retry-upload]")
      .forEach((element) =>
        element.addEventListener("click", () => {
          if (element.dataset.retryUpload)
            void this.#retryUpload(element.dataset.retryUpload);
        }),
      );
    this.#root
      .querySelector('[data-action="attach"]')
      ?.addEventListener("click", () =>
        this.#root.querySelector<HTMLInputElement>(".sk-file-input")?.click(),
      );
    this.#root
      .querySelector<HTMLInputElement>(".sk-file-input")
      ?.addEventListener("change", (event) => {
        const input = event.target as HTMLInputElement;
        this.#selectFiles(input.files);
        input.value = "";
      });
    this.#root
      .querySelectorAll<HTMLElement>("[data-retry]")
      .forEach((element) => {
        const clientMessageId = element.dataset.retry;
        if (clientMessageId)
          element.addEventListener("click", () => {
            void this.#retry(clientMessageId);
          });
      });
    this.#root
      .querySelector('[data-action="refresh"]')
      ?.addEventListener("click", () => void this.refreshInbox());
    this.#root
      .querySelector('[data-action="knowledge"]')
      ?.addEventListener("click", () => void this.#openKnowledge());
    this.#root
      .querySelector('[data-action="back"]')
      ?.addEventListener("click", () => this.closeConversation());
    for (const action of ["assign", "resolve", "reopen", "spam"] as const)
      this.#root
        .querySelector(`[data-action="${action}"]`)
        ?.addEventListener("click", () => void this.#action(action));
    this.#root
      .querySelector('[data-action="reply"]')
      ?.addEventListener("click", () => {
        this.#stopTyping();
        this.#mode = "reply";
        this.#render();
      });
    this.#root
      .querySelector('[data-action="note"]')
      ?.addEventListener("click", () => {
        this.#stopTyping();
        this.#mode = "note";
        this.#render();
      });
    this.#root
      .querySelector('[data-action="send"]')
      ?.addEventListener("click", () => void this.#send());
    const textarea = this.#root.querySelector("textarea");
    textarea?.addEventListener("input", () => {
      this.#startTyping();
      if (this.#active)
        this.#drafts.set(
          `${this.#active}:${this.#mode}`,
          (textarea as HTMLTextAreaElement).value,
        );
    });
    textarea?.addEventListener("keydown", (event) => {
      const keyboard = event as KeyboardEvent;
      if (keyboard.key === "Enter" && !keyboard.shiftKey) {
        keyboard.preventDefault();
        void this.#send();
      }
    });
    this.#root
      .querySelector('[data-action="assignment"]')
      ?.addEventListener("change", (event) =>
        this.setFilters({
          ...this.#filters,
          assignment: (event.target as HTMLSelectElement).value as
            "all" | "mine",
        }),
      );
    this.#root
      .querySelector('[data-action="status"]')
      ?.addEventListener("change", (event) => {
        const value = (event.target as HTMLSelectElement).value;
        this.setFilters({
          ...this.#filters,
          status: value
            ? (value as SupportDashboardFilters["status"])
            : undefined,
        });
      });
  }
}

export function createSupportDashboard(options: SupportDashboardOptions) {
  return new SupportDashboardController(options);
}
export { mergeMessages };
