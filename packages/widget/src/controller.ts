/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/restrict-template-expressions */
import {
  customerConversationSchema,
  customerMessageSchema,
  publicWidgetConfigurationSchema,
  widgetSocketEventEnvelopeSchema,
  type CustomerConversation,
  type CustomerMessage,
} from "@crazyglegit/support-contracts/widget";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";
import { resolveOptions, type ResolvedOptions } from "./config.js";
import { WidgetHttpClient, WidgetRequestError } from "./http.js";
import { uploadToPresignedTarget, type DirectUploadHandle } from "./upload.js";
import type {
  SupportWidgetEvent,
  SupportWidgetEventName,
  SupportWidgetListener,
  SupportWidgetOptions,
} from "./types.js";

type View = "home" | "list" | "new" | "conversation";
type Connection =
  "connecting" | "connected" | "reconnecting" | "offline" | "http-only";
interface PendingMessage {
  readonly clientMessageId: string;
  readonly body: string;
  status: "sending" | "failed";
  readonly attachmentIds?: readonly string[];
}
interface PendingUpload {
  readonly localId: string;
  readonly file: File;
  attachmentId?: string;
  progress: number;
  status: "uploading" | "ready" | "failed" | "cancelled";
  error?: string;
  handle?: DirectUploadHandle;
}
interface State {
  open: boolean;
  initialized: boolean;
  loading: boolean;
  view: View;
  connection: Connection;
  conversations: CustomerConversation[];
  messages: CustomerMessage[];
  pending: PendingMessage[];
  activeId: string | undefined;
  draft: string;
  error: string | undefined;
  unread: number;
  agentTyping: boolean;
  newMessages: boolean;
  uploads: PendingUpload[];
}

const sessionSchema = z.strictObject({
  actor: z.looseObject({ type: z.enum(["customer", "visitor"]) }),
});
const conversationsSchema = z.array(customerConversationSchema);
const messagesSchema = z.array(customerMessageSchema);
const detailSchema = z.strictObject({
  conversation: customerConversationSchema,
});
const createdSchema = z.strictObject({
  conversation: customerConversationSchema,
  initialMessage: customerMessageSchema.optional(),
});
const receiptSchema = z.unknown();
const attachmentSchema = z.strictObject({
  id: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(127),
  sizeBytes: z.number().int().nonnegative(),
  status: z.literal("ready"),
});
const uploadIntentSchema = z.strictObject({
  attachment: attachmentSchema
    .omit({ status: true })
    .extend({ status: z.literal("pending_upload") }),
  upload: z.strictObject({
    method: z.literal("PUT"),
    url: z.url(),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.iso.datetime({ offset: true }),
  }),
});
const PUBLIC_MESSAGE_TYPES = new Set([
  "text",
  "image",
  "file",
  "quick_reply",
  "bot",
  "system",
]);

const CSS = `
:host{all:initial;--sw-accent:#2563eb;--sw-bg:#fff;--sw-fg:#111827;--sw-border:#e5e7eb;--sw-muted:#667085;--sw-customer:#2563eb;--sw-agent:#f2f4f7;--sw-radius:18px;--sw-font:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--sw-width:380px;--sw-height:620px;font-family:var(--sw-font);color:var(--sw-fg);font-size:16px;line-height:1.45;color-scheme:light}
:host([data-theme=dark]){--sw-bg:#111827;--sw-fg:#f9fafb;--sw-border:#374151;--sw-muted:#9ca3af;--sw-agent:#253044;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}button,textarea{font:inherit}button{cursor:pointer}.root{position:fixed;bottom:max(20px,env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:flex-end;gap:12px;z-index:var(--sw-z)}.root.left{left:max(20px,env(safe-area-inset-left));align-items:flex-start}.root.right{right:max(20px,env(safe-area-inset-right))}
.launcher{width:56px;height:56px;border:0;border-radius:999px;background:var(--sw-accent);color:#fff;display:grid;place-items:center;box-shadow:0 10px 30px #0003;position:relative}.launcher:focus-visible,.icon:focus-visible,.send:focus-visible,.primary:focus-visible,.row:focus-visible,.retry:focus-visible,textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--sw-accent),white 35%);outline-offset:2px}.launcher svg{width:25px}.badge{position:absolute;right:-4px;top:-5px;min-width:22px;height:22px;padding:0 6px;border-radius:99px;background:#dc2626;color:#fff;border:2px solid var(--sw-bg);font:700 12px/18px var(--sw-font)}
.panel{width:min(var(--sw-width),calc(100vw - 32px));height:min(var(--sw-height),calc(100dvh - 110px));background:var(--sw-bg);border:1px solid var(--sw-border);border-radius:var(--sw-radius);box-shadow:0 20px 60px #0003;overflow:hidden;overscroll-behavior:contain;display:flex;flex-direction:column}.header{min-height:64px;padding:10px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--sw-border)}.title{font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.icon{width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:inherit;display:grid;place-items:center}.icon:hover{background:var(--sw-agent)}.status{padding:5px 12px;font-size:13px;color:var(--sw-muted);background:var(--sw-agent);text-align:center}.status.error{color:#b42318}.content{flex:1;min-height:0;overflow:auto;padding:20px}.home{display:flex;flex-direction:column;height:100%;justify-content:center}.home h2{font-size:24px;margin:0 0 8px}.muted{color:var(--sw-muted)}.primary,.send{border:0;background:var(--sw-accent);color:#fff;border-radius:12px;min-height:44px;padding:10px 16px;font-weight:650}.secondary{margin-top:10px;border:1px solid var(--sw-border);background:transparent;color:inherit}.rows{display:flex;flex-direction:column;gap:8px}.row{width:100%;text-align:left;border:1px solid var(--sw-border);background:transparent;color:inherit;border-radius:14px;padding:14px}.row strong,.row span{display:block}.row small{color:var(--sw-muted)}.messages{padding:16px;display:flex;flex-direction:column;gap:10px}.bubble{max-width:82%;padding:10px 13px;border-radius:14px;background:var(--sw-agent);white-space:pre-wrap;overflow-wrap:anywhere}.bubble.mine{align-self:flex-end;background:var(--sw-customer);color:#fff}.bubble.pending{opacity:.72}.bubble.failed{border:1px solid #dc2626}.bubble small{display:block;margin-top:4px;opacity:.72;font-size:11px}.retry{border:0;background:transparent;color:inherit;text-decoration:underline;padding:2px}.composer{border-top:1px solid var(--sw-border);padding:10px max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:8px}.composer textarea{resize:none;min-height:44px;max-height:112px;flex:1;border:1px solid var(--sw-border);border-radius:12px;background:var(--sw-bg);color:inherit;padding:10px 12px}.send{padding-inline:14px}.empty{text-align:center;color:var(--sw-muted);margin:auto}.typing{font-size:13px;color:var(--sw-muted);padding:0 16px 6px}.announce{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.counter{font-size:11px;color:var(--sw-muted);text-align:right}.new{position:absolute;bottom:84px;align-self:center;border:1px solid var(--sw-border);border-radius:99px;padding:7px 12px;background:var(--sw-bg);color:inherit;box-shadow:0 4px 14px #0002}
.attach{width:44px;height:44px;border:1px solid var(--sw-border);border-radius:12px;background:transparent;color:inherit}.upload-list,.message-files{width:100%;display:grid;gap:6px}.file-card{border:1px solid var(--sw-border);border-radius:10px;padding:8px;display:flex;gap:8px;align-items:center;min-width:0}.file-card span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.file-card button{border:0;background:transparent;color:inherit;text-decoration:underline}.file-card progress{width:72px}.composer{flex-wrap:wrap}
@media(max-width:520px){.root,.root.left,.root.right{inset:0;display:block}.panel{width:100vw;height:100dvh;max-height:none;border:0;border-radius:0}.launcher{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom))}.root.left .launcher{left:max(16px,env(safe-area-inset-left));right:auto}.panel+.launcher{display:none}.content{padding:18px}.header{padding-top:max(10px,env(safe-area-inset-top))}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;

function escape(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ] ?? char,
  );
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
function isMine(message: CustomerMessage): boolean {
  return message.senderType === "customer" || message.senderType === "visitor";
}

/** One isolated browser widget instance. */
export class SupportWidgetController {
  readonly #options: ResolvedOptions;
  readonly #host: HTMLElement;
  readonly #root: ShadowRoot;
  readonly #http: WidgetHttpClient;
  readonly #localTitle: boolean;
  readonly #localGreeting: boolean;
  readonly #localLauncherLabel: boolean;
  readonly #localPosition: boolean;
  readonly #localTheme: boolean;
  readonly #localAccentColor: boolean;
  readonly #listeners = new Map<
    SupportWidgetEventName,
    Set<SupportWidgetListener>
  >();
  readonly #seenEvents = new Set<string>();
  #state: State = {
    open: false,
    initialized: false,
    loading: true,
    view: "home",
    connection: "connecting",
    conversations: [],
    messages: [],
    pending: [],
    activeId: undefined,
    draft: "",
    error: undefined,
    unread: 0,
    agentTyping: false,
    newMessages: false,
    uploads: [],
  };
  #socket: Socket | undefined;
  #destroyed = false;
  #actorType: "customer" | "visitor" | undefined;
  #typingTimer: ReturnType<typeof setTimeout> | undefined;
  #creation: Promise<void> | undefined;
  #lastFocus: HTMLElement | undefined;
  #messagesElement: HTMLElement | null = null;
  #position: "bottom-left" | "bottom-right";
  #theme: "light" | "dark" | "system";
  #accentColor: string;
  #colorScheme: MediaQueryList | undefined;
  #typingActive = false;
  #attachmentConfig:
    | {
        maxFileSizeBytes: number;
        maxFilesPerMessage: number;
        allowedMimeTypes: readonly string[];
      }
    | undefined;
  readonly #readMessageKeys = new Set<string>();
  readonly #onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.#state.open) {
      event.preventDefault();
      this.close();
    }
  };
  readonly #onColorSchemeChange = (): void => {
    if (this.#theme === "system") this.#applyTheme();
  };
  #title: string;
  #greeting: string;
  #launcherLabel: string;

  public constructor(options: SupportWidgetOptions = {}) {
    if (typeof document === "undefined")
      throw new Error("SupportWidget can only be created in a browser.");
    this.#options = resolveOptions(options);
    this.#localTitle = options.title !== undefined;
    this.#localGreeting =
      options.greeting !== undefined || options.strings?.greeting !== undefined;
    this.#localLauncherLabel =
      options.launcherLabel !== undefined ||
      options.strings?.launcherLabel !== undefined;
    this.#localPosition = options.position !== undefined;
    this.#localTheme = options.theme !== undefined;
    this.#localAccentColor = options.accentColor !== undefined;
    this.#title = this.#options.title;
    this.#greeting = this.#options.strings.greeting;
    this.#launcherLabel = this.#options.strings.launcherLabel;
    this.#position = this.#options.position;
    this.#theme = this.#options.theme;
    this.#accentColor = this.#options.accentColor ?? "#2563eb";
    this.#http = new WidgetHttpClient(
      this.#options.apiBaseUrl,
      this.#options.credentials,
      this.#options.requestTimeoutMs,
    );
    this.#host = document.createElement("div");
    this.#host.dataset.supportWidget = "";
    this.#root = this.#host.attachShadow({ mode: "open" });
    (this.#options.container ?? document.body).append(this.#host);
    document.addEventListener("keydown", this.#onDocumentKeydown);
    this.#applyTheme();
    this.#bind();
    this.#render();
    void this.#initialize();
  }
  public open(): void {
    if (this.#destroyed || this.#state.open) return;
    this.#lastFocus =
      this.#root.activeElement instanceof HTMLElement
        ? this.#root.activeElement
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
    this.#state.open = true;
    this.#emit("opened", {});
    this.#render();
    queueMicrotask(() =>
      this.#root
        .querySelector<HTMLElement>(".panel button,.panel textarea")
        ?.focus(),
    );
  }
  public close(): void {
    if (this.#destroyed || !this.#state.open) return;
    this.#stopTyping();
    this.#state.open = false;
    this.#emit("closed", {});
    this.#render();
    (this.#lastFocus?.isConnected
      ? this.#lastFocus
      : this.#root.querySelector<HTMLElement>(".launcher")
    )?.focus();
  }
  public toggle(): void {
    if (this.#state.open) this.close();
    else this.open();
  }
  public isOpen(): boolean {
    return this.#state.open;
  }
  public on(
    name: SupportWidgetEventName,
    listener: SupportWidgetListener,
  ): () => void {
    const set = this.#listeners.get(name) ?? new Set();
    set.add(listener);
    this.#listeners.set(name, set);
    return () => this.off(name, listener);
  }
  public off(
    name: SupportWidgetEventName,
    listener: SupportWidgetListener,
  ): void {
    this.#listeners.get(name)?.delete(listener);
  }
  public destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#stopTyping();
    this.#http.dispose();
    document.removeEventListener("keydown", this.#onDocumentKeydown);
    this.#colorScheme?.removeEventListener("change", this.#onColorSchemeChange);
    this.#socket?.removeAllListeners();
    this.#socket?.disconnect();
    for (const upload of this.#state.uploads) upload.handle?.cancel();
    this.#host.remove();
    this.#listeners.clear();
  }

  #isDestroyed(): boolean {
    return this.#destroyed;
  }

  #emit(type: SupportWidgetEventName, data: unknown): void {
    const event: SupportWidgetEvent = { type, data };
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
  #applyTheme(): void {
    const o = this.#options,
      t = o.themeVariables;
    this.#colorScheme?.removeEventListener("change", this.#onColorSchemeChange);
    this.#colorScheme = undefined;
    if (this.#theme === "system") {
      this.#colorScheme = matchMedia("(prefers-color-scheme: dark)");
      this.#colorScheme.addEventListener("change", this.#onColorSchemeChange);
    }
    this.#host.dataset.theme =
      this.#theme === "system"
        ? this.#colorScheme?.matches
          ? "dark"
          : "light"
        : this.#theme;
    const s = this.#host.style;
    s.setProperty("--sw-z", String(o.zIndex));
    s.setProperty("--sw-accent", this.#accentColor);
    if (t?.background) s.setProperty("--sw-bg", t.background);
    if (t?.foreground) s.setProperty("--sw-fg", t.foreground);
    if (t?.border) s.setProperty("--sw-border", t.border);
    if (t?.muted) s.setProperty("--sw-muted", t.muted);
    if (t?.customerBubble) s.setProperty("--sw-customer", t.customerBubble);
    if (t?.agentBubble) s.setProperty("--sw-agent", t.agentBubble);
    if (t?.radius !== undefined) s.setProperty("--sw-radius", `${t.radius}px`);
    if (t?.fontFamily) s.setProperty("--sw-font", t.fontFamily);
    if (t?.panelWidth) s.setProperty("--sw-width", `${t.panelWidth}px`);
    if (t?.panelHeight) s.setProperty("--sw-height", `${t.panelHeight}px`);
  }
  #bind(): void {
    this.#root.addEventListener("click", (e) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-action]");
      if (!el) return;
      const a = el.dataset.action;
      if (a === "toggle") this.toggle();
      else if (a === "close") this.close();
      else if (a === "home") {
        this.#leaveActive();
        this.#state.view = "home";
        this.#render();
      } else if (a === "list") {
        this.#leaveActive();
        this.#state.view = "list";
        this.#render();
      } else if (a === "new") {
        this.#state.view = "new";
        this.#render();
        queueMicrotask(() =>
          this.#root.querySelector<HTMLTextAreaElement>("textarea")?.focus(),
        );
      } else if (a === "conversation" && el.dataset.id)
        void this.#activate(el.dataset.id);
      else if (a === "send") void this.#send();
      else if (a === "retry" && el.dataset.id) void this.#retry(el.dataset.id);
      else if (a === "new-messages") this.#scrollBottom();
      else if (a === "pick-files")
        this.#root
          .querySelector<HTMLInputElement>('input[type="file"]')
          ?.click();
      else if (a === "remove-upload" && el.dataset.id)
        void this.#removeUpload(el.dataset.id);
      else if (a === "retry-upload" && el.dataset.id)
        void this.#retryUpload(el.dataset.id);
      else if (a === "download" && el.dataset.id)
        void this.#download(el.dataset.id);
    });
    this.#root.addEventListener("input", (e) => {
      if (e.target instanceof HTMLTextAreaElement) {
        this.#state.draft = e.target.value;
        this.#startTyping();
        this.#updateComposer();
      }
    });
    this.#root.addEventListener("change", (event) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.type === "file"
      ) {
        this.#selectFiles(event.target.files);
        event.target.value = "";
      }
    });
    this.#root.addEventListener("keydown", (event) => {
      const e = event as KeyboardEvent;
      if (e.key === "Escape" && this.#state.open) {
        e.preventDefault();
        this.close();
      }
      if (
        e.target instanceof HTMLTextAreaElement &&
        e.key === "Enter" &&
        !e.shiftKey
      ) {
        e.preventDefault();
        void this.#send();
      }
    });
    this.#root.addEventListener(
      "scroll",
      (e) => {
        if (e.target === this.#messagesElement && this.#messagesElement) {
          const atBottom =
            this.#messagesElement.scrollHeight -
              this.#messagesElement.scrollTop -
              this.#messagesElement.clientHeight <
            48;
          if (atBottom) {
            this.#state.newMessages = false;
            this.#render();
          }
        }
      },
      true,
    );
  }
  async #initialize(): Promise<void> {
    try {
      const server = await this.#http.request(
        "/widget/config",
        publicWidgetConfigurationSchema,
      );
      if (this.#isDestroyed()) return;
      const session = await this.#http.request("/session", sessionSchema, {
        method: "POST",
        body: "{}",
      });
      if (this.#isDestroyed()) return;
      const conversations = await this.#http.request(
        "/conversations",
        conversationsSchema,
      );
      if (this.#isDestroyed()) return;
      if (server.title && !this.#localTitle) this.#title = server.title;
      if (server.greeting && !this.#localGreeting)
        this.#greeting = server.greeting;
      if (server.launcherLabel && !this.#localLauncherLabel)
        this.#launcherLabel = server.launcherLabel;
      if (server.position && !this.#localPosition)
        this.#position = server.position;
      if (server.theme && !this.#localTheme) this.#theme = server.theme;
      if (server.accentColor && !this.#localAccentColor)
        this.#accentColor = server.accentColor;
      this.#applyTheme();
      this.#actorType = session.actor.type;
      this.#attachmentConfig = server.features.attachments
        ? server.attachments
        : undefined;
      this.#state.conversations = conversations;
      this.#state.initialized = true;
      this.#state.loading = false;
      this.#connect();
      this.#emit("ready", {});
    } catch (error) {
      this.#fail(error);
    }
    this.#render();
  }
  #connect(): void {
    if (!this.#options.socketUrl || !this.#actorType) {
      this.#state.connection = "http-only";
      return;
    }
    this.#socket = io(this.#options.socketUrl, {
      withCredentials: true,
      auth: { actorType: this.#actorType },
      autoConnect: true,
    });
    this.#socket.on("connect", () => {
      const reconnecting =
        this.#state.connection === "reconnecting" ||
        this.#state.connection === "offline";
      this.#state.connection = "connected";
      this.#emit("connection.changed", { state: "connected" });
      if (this.#state.activeId)
        void this.#join(this.#state.activeId, reconnecting);
      this.#render();
    });
    this.#socket.on("disconnect", () => {
      this.#clearTypingLocal();
      this.#state.connection = "reconnecting";
      this.#state.agentTyping = false;
      this.#emit("connection.changed", { state: "reconnecting" });
      this.#render();
    });
    this.#socket.on("connect_error", () => {
      this.#state.connection = navigator.onLine ? "http-only" : "offline";
      this.#emit("connection.changed", { state: this.#state.connection });
      this.#render();
    });
    for (const event of [
      "message.created",
      "message.read",
      "conversation.updated",
      "conversation.status_changed",
      "typing.updated",
      "presence.updated",
      "support.error",
    ] as const)
      this.#socket.on(event, (value: unknown) => void this.#realtime(value));
  }
  async #realtime(value: unknown): Promise<void> {
    const parsed = widgetSocketEventEnvelopeSchema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.version !== 1 ||
      this.#seenEvents.has(parsed.data.eventId)
    )
      return;
    this.#seenEvents.add(parsed.data.eventId);
    if (this.#seenEvents.size > 1000)
      this.#seenEvents.delete(this.#seenEvents.values().next().value ?? "");
    const envelope = parsed.data;
    if (envelope.eventType === "typing.updated") {
      const data = envelope.data as {
        actor?: { type?: string };
        active?: boolean;
      };
      if (data.actor?.type === "agent")
        this.#state.agentTyping = data.active === true;
      this.#render();
      return;
    }
    if (envelope.eventType === "message.created") {
      const msg = customerMessageSchema.safeParse(envelope.data);
      if (msg.success && PUBLIC_MESSAGE_TYPES.has(msg.data.type)) {
        const before = this.#state.messages.length;
        this.#mergeMessages([msg.data]);
        if (this.#state.messages.length > before && !isMine(msg.data)) {
          this.#incoming(msg.data);
        }
      } else if (envelope.conversationId === this.#state.activeId)
        await this.#resync();
    } else if (
      envelope.eventType === "conversation.updated" ||
      envelope.eventType === "conversation.status_changed"
    )
      await this.#refreshConversations();
    else if (envelope.eventType === "support.error")
      this.#emit("error", {
        message: "Realtime support is temporarily unavailable.",
      });
    this.#render();
  }
  #incoming(message: CustomerMessage): void {
    const atBottom = this.#messagesElement
      ? this.#messagesElement.scrollHeight -
          this.#messagesElement.scrollTop -
          this.#messagesElement.clientHeight <
        48
      : false;
    if (this.#state.open && this.#state.view === "conversation" && atBottom) {
      queueMicrotask(() => this.#scrollBottom());
      void this.#markRead(message);
    } else {
      this.#state.unread++;
      this.#state.newMessages = this.#state.open;
      this.#emit("unread.changed", { count: this.#state.unread });
    }
    this.#emit("message.received", { conversationId: message.conversationId });
  }
  async #activate(id: string): Promise<void> {
    this.#leaveActive();
    this.#state.activeId = id;
    this.#state.view = "conversation";
    this.#state.loading = true;
    this.#state.unread = 0;
    this.#emit("unread.changed", { count: 0 });
    this.#render();
    try {
      await this.#join(id, true);
    } catch (error) {
      this.#fail(error);
    } finally {
      this.#state.loading = false;
      this.#render();
      queueMicrotask(() => this.#scrollBottom());
    }
  }
  async #join(id: string, resync: boolean): Promise<void> {
    if (this.#socket?.connected)
      await new Promise<void>((resolve, reject) =>
        this.#socket?.emit(
          "conversation.join",
          { conversationId: id },
          (ack: { ok: boolean }) =>
            ack.ok ? resolve() : reject(new Error("join failed")),
        ),
      );
    if (resync) await this.#resync();
  }
  #leaveActive(): void {
    this.#stopTyping();
    if (this.#state.activeId && this.#socket?.connected)
      this.#socket.emit(
        "conversation.leave",
        { conversationId: this.#state.activeId },
        () => undefined,
      );
    this.#state.activeId = undefined;
    this.#state.messages = [];
    this.#state.pending = [];
    for (const upload of this.#state.uploads) upload.handle?.cancel();
    this.#state.uploads = [];
  }
  async #resync(): Promise<void> {
    const id = this.#state.activeId;
    if (!id) return;
    const [detail, messages] = await Promise.all([
      this.#http.request(
        `/conversations/${encodeURIComponent(id)}`,
        detailSchema,
      ),
      this.#http.request(
        `/conversations/${encodeURIComponent(id)}/messages`,
        messagesSchema,
      ),
    ]);
    this.#state.conversations = this.#state.conversations.map((c) =>
      c.id === id ? detail.conversation : c,
    );
    this.#mergeMessages(messages);
  }
  async #refreshConversations(): Promise<void> {
    this.#state.conversations = await this.#http.request(
      "/conversations",
      conversationsSchema,
    );
    if (this.#state.activeId) await this.#resync();
  }
  #mergeMessages(messages: readonly CustomerMessage[]): void {
    const byId = new Map(this.#state.messages.map((m) => [m.id, m]));
    const byClientId = new Map(
      this.#state.messages.flatMap((message) =>
        message.clientMessageId ? [[message.clientMessageId, message.id]] : [],
      ),
    );
    for (const message of messages) {
      if (!PUBLIC_MESSAGE_TYPES.has(message.type)) continue;
      if (message.clientMessageId) {
        const duplicateId = byClientId.get(message.clientMessageId);
        if (duplicateId && duplicateId !== message.id) byId.delete(duplicateId);
        byClientId.set(message.clientMessageId, message.id);
      }
      byId.set(message.id, message);
    }
    this.#state.messages = [...byId.values()].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    const keys = new Set(
      this.#state.messages.flatMap((m) =>
        m.clientMessageId ? [m.clientMessageId] : [],
      ),
    );
    this.#state.pending = this.#state.pending.filter(
      (p) => !keys.has(p.clientMessageId),
    );
  }
  async #send(): Promise<void> {
    const body = this.#state.draft.trim();
    const attachmentIds = this.#state.uploads.flatMap((upload) =>
      upload.status === "ready" && upload.attachmentId
        ? [upload.attachmentId]
        : [],
    );
    if (
      (!body && attachmentIds.length === 0) ||
      this.#state.uploads.some((upload) => upload.status === "uploading") ||
      body.length > this.#options.maxMessageLength
    )
      return;
    this.#stopTyping();
    const existing = this.#state.pending.find(
      (p) => p.body === body && p.status === "failed",
    );
    const id = existing?.clientMessageId ?? crypto.randomUUID();
    if (existing) existing.status = "sending";
    else
      this.#state.pending.push({
        clientMessageId: id,
        body,
        status: "sending",
        attachmentIds,
      });
    this.#state.draft = "";
    this.#render();
    try {
      if (this.#state.view === "new" || !this.#state.activeId) {
        if (this.#creation) return;
        this.#creation = this.#createConversation(body, id);
        await this.#creation;
      } else {
        const message = await this.#http.request(
          `/conversations/${encodeURIComponent(this.#state.activeId)}/messages`,
          customerMessageSchema,
          {
            method: "POST",
            body: JSON.stringify({ body, clientMessageId: id, attachmentIds }),
          },
        );
        this.#mergeMessages([message]);
        this.#emit("message.sent", { conversationId: message.conversationId });
        this.#state.uploads = [];
      }
    } catch (error) {
      const pending = this.#state.pending.find((p) => p.clientMessageId === id);
      if (pending) pending.status = "failed";
      this.#state.draft = body;
      this.#fail(error);
    } finally {
      this.#creation = undefined;
      this.#render();
      queueMicrotask(() => this.#scrollBottom());
    }
  }
  async #createConversation(body: string, id: string): Promise<void> {
    const created = await this.#http.request("/conversations", createdSchema, {
      method: "POST",
      body: JSON.stringify({ initialMessage: { body, clientMessageId: id } }),
    });
    this.#state.conversations = [
      created.conversation,
      ...this.#state.conversations.filter(
        (c) => c.id !== created.conversation.id,
      ),
    ];
    this.#state.activeId = created.conversation.id;
    this.#state.view = "conversation";
    if (created.initialMessage) this.#mergeMessages([created.initialMessage]);
    await this.#join(created.conversation.id, true);
    this.#emit("conversation.created", {
      conversationId: created.conversation.id,
    });
  }
  async #retry(id: string): Promise<void> {
    const pending = this.#state.pending.find((p) => p.clientMessageId === id);
    if (!pending) return;
    this.#state.draft = pending.body;
    await this.#send();
  }
  #selectFiles(files: FileList | null): void {
    if (!files || !this.#attachmentConfig || !this.#state.activeId) return;
    const remaining =
      this.#attachmentConfig.maxFilesPerMessage - this.#state.uploads.length;
    for (const file of [...files].slice(0, Math.max(0, remaining))) {
      const item: PendingUpload = {
        localId: crypto.randomUUID(),
        file,
        progress: 0,
        status: "uploading",
      };
      if (file.size > this.#attachmentConfig.maxFileSizeBytes) {
        item.status = "failed";
        item.error = "File is too large.";
      } else if (!this.#attachmentConfig.allowedMimeTypes.includes(file.type)) {
        item.status = "failed";
        item.error = "File type is not allowed.";
      }
      this.#state.uploads.push(item);
      if (item.status === "uploading") void this.#upload(item);
    }
    this.#render();
  }
  async #upload(item: PendingUpload): Promise<void> {
    const conversationId = this.#state.activeId;
    if (!conversationId) return;
    item.status = "uploading";
    item.progress = 0;
    delete item.error;
    this.#render();
    try {
      const intent = await this.#http.request(
        "/attachments/upload-intents",
        uploadIntentSchema,
        {
          method: "POST",
          body: JSON.stringify({
            conversationId,
            fileName: item.file.name,
            mimeType: item.file.type,
            sizeBytes: item.file.size,
          }),
        },
      );
      if (this.#state.activeId !== conversationId) return;
      item.attachmentId = intent.attachment.id;
      item.handle = uploadToPresignedTarget(
        intent.upload,
        item.file,
        (progress) => {
          if (!this.#destroyed && this.#state.activeId === conversationId) {
            item.progress = progress;
            this.#render();
          }
        },
      );
      await item.handle.completed;
      await this.#http.request(
        `/attachments/${encodeURIComponent(intent.attachment.id)}/complete?conversationId=${encodeURIComponent(conversationId)}`,
        attachmentSchema,
        { method: "POST", body: "{}" },
      );
      if (this.#state.activeId !== conversationId) return;
      item.status = "ready";
      item.progress = 100;
      delete item.handle;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        item.status = "failed";
        item.error =
          error instanceof DOMException && error.name === "AbortError"
            ? "Upload cancelled."
            : "Upload failed.";
      }
      delete item.handle;
    }
    this.#render();
  }
  async #removeUpload(localId: string): Promise<void> {
    const item = this.#state.uploads.find(
      (upload) => upload.localId === localId,
    );
    if (!item) return;
    item.status = "cancelled";
    item.handle?.cancel();
    this.#state.uploads = this.#state.uploads.filter(
      (upload) => upload !== item,
    );
    if (item.attachmentId && this.#state.activeId) {
      try {
        await this.#http.request(
          `/attachments/${encodeURIComponent(item.attachmentId)}?conversationId=${encodeURIComponent(this.#state.activeId)}`,
          z.unknown(),
          { method: "DELETE" },
        );
      } catch {
        // The server remains authoritative and the attachment stays unusable.
      }
    }
    this.#render();
  }
  async #retryUpload(localId: string): Promise<void> {
    const item = this.#state.uploads.find(
      (upload) => upload.localId === localId,
    );
    if (!item) return;
    delete item.attachmentId;
    await this.#upload(item);
  }
  async #download(attachmentId: string): Promise<void> {
    if (!this.#state.activeId) return;
    const result = await this.#http.request(
      `/attachments/${encodeURIComponent(attachmentId)}/download?conversationId=${encodeURIComponent(this.#state.activeId)}`,
      z.strictObject({
        url: z.url(),
        expiresAt: z.iso.datetime({ offset: true }),
      }),
    );
    const link = document.createElement("a");
    link.href = result.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }
  #startTyping(): void {
    if (!this.#state.activeId || !this.#socket?.connected) return;
    if (!this.#typingActive) {
      this.#typingActive = true;
      this.#socket.emit(
        "typing.start",
        { conversationId: this.#state.activeId },
        () => undefined,
      );
    }
    if (this.#typingTimer) clearTimeout(this.#typingTimer);
    this.#typingTimer = setTimeout(() => this.#stopTyping(), 2000);
  }
  #stopTyping(): void {
    if (this.#typingTimer) clearTimeout(this.#typingTimer);
    this.#typingTimer = undefined;
    if (this.#typingActive && this.#state.activeId && this.#socket?.connected)
      this.#socket.emit(
        "typing.stop",
        { conversationId: this.#state.activeId },
        () => undefined,
      );
    this.#typingActive = false;
  }
  #clearTypingLocal(): void {
    if (this.#typingTimer) clearTimeout(this.#typingTimer);
    this.#typingTimer = undefined;
    this.#typingActive = false;
  }
  async #markRead(message: CustomerMessage): Promise<void> {
    if (
      !this.#state.open ||
      this.#state.activeId !== message.conversationId ||
      isMine(message)
    )
      return;
    const readKey = message.clientMessageId
      ? `client:${message.clientMessageId}`
      : `message:${message.id}`;
    if (this.#readMessageKeys.has(readKey)) return;
    this.#readMessageKeys.add(readKey);
    try {
      await this.#http.request(
        `/messages/${encodeURIComponent(message.id)}/read`,
        receiptSchema,
        { method: "POST", body: "{}" },
      );
    } catch {
      this.#readMessageKeys.delete(readKey);
    }
  }
  #fail(error: unknown): void {
    const message =
      error instanceof WidgetRequestError
        ? error.message
        : "Support is temporarily unavailable.";
    this.#state.error = message;
    this.#state.loading = false;
    if (
      error instanceof WidgetRequestError &&
      (error.kind === "network" || error.kind === "timeout")
    )
      this.#state.connection = navigator.onLine ? "http-only" : "offline";
    this.#emit("error", { message });
  }
  #scrollBottom(): void {
    if (this.#messagesElement) {
      this.#messagesElement.scrollTop = this.#messagesElement.scrollHeight;
      this.#state.newMessages = false;
      const latest = [...this.#state.messages]
        .reverse()
        .find((m) => !isMine(m));
      if (latest) void this.#markRead(latest);
    }
  }
  #updateComposer(): void {
    const textarea = this.#root.querySelector<HTMLTextAreaElement>("textarea"),
      send = this.#root.querySelector<HTMLButtonElement>(".send"),
      counter = this.#root.querySelector<HTMLElement>(".counter");
    if (textarea && send) {
      send.disabled =
        (!textarea.value.trim() &&
          !this.#state.uploads.some((upload) => upload.status === "ready")) ||
        this.#state.uploads.some((upload) => upload.status === "uploading") ||
        textarea.value.length > this.#options.maxMessageLength;
      if (counter)
        counter.textContent = `${textarea.value.length}/${this.#options.maxMessageLength}`;
    }
  }
  #render(): void {
    if (this.#destroyed) return;
    const activeElement = this.#root.activeElement;
    const activeAction =
      activeElement instanceof HTMLElement
        ? activeElement.dataset.action
        : undefined;
    const activeId =
      activeElement instanceof HTMLElement
        ? activeElement.dataset.id
        : undefined;
    const restoreComposer = activeElement instanceof HTMLTextAreaElement;
    const selectionStart = restoreComposer
      ? activeElement.selectionStart
      : null;
    const selectionEnd = restoreComposer ? activeElement.selectionEnd : null;
    const s = this.#state,
      o = this.#options,
      back =
        s.view !== "home"
          ? `<button class="icon" data-action="${s.view === "conversation" ? "list" : "home"}" aria-label="${escape(o.strings.back)}">←</button>`
          : "";
    const connection =
      s.connection === "reconnecting"
        ? `<div class="status" role="status">${escape(o.strings.reconnecting)}</div>`
        : s.connection === "offline"
          ? `<div class="status error" role="status">${escape(o.strings.offline)}</div>`
          : s.connection === "http-only"
            ? `<div class="status" role="status">Live updates unavailable</div>`
            : "";
    const panel = s.open
      ? `<section class="panel" role="dialog" aria-modal="false" aria-label="${escape(this.#title)}"><header class="header">${back}<div class="title">${escape(this.#title)}</div><button class="icon" data-action="close" aria-label="${escape(o.strings.close)}">✕</button></header>${connection}${this.#body()}</section>`
      : "";
    this.#root.innerHTML = `<style>${CSS}</style><div class="root ${this.#position === "bottom-left" ? "left" : "right"}">${panel}<button class="launcher" data-action="toggle" aria-label="${escape(s.open ? o.strings.close : this.#launcherLabel)}" aria-expanded="${String(s.open)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v12H7l-3 3V4Zm3 4v2h10V8H7Zm0 4v2h7v-2H7Z"/></svg>${s.unread ? `<span class="badge" aria-label="${s.unread} unread messages">${s.unread > 99 ? "99+" : s.unread}</span>` : ""}</button><div class="announce" aria-live="polite">${s.agentTyping ? "An agent is typing" : s.newMessages ? o.strings.newMessages : ""}</div></div>`;
    this.#messagesElement =
      this.#root.querySelector<HTMLElement>(".content.messages");
    if (restoreComposer) {
      const textarea =
        this.#root.querySelector<HTMLTextAreaElement>("textarea");
      textarea?.focus();
      if (textarea && selectionStart !== null && selectionEnd !== null)
        textarea.setSelectionRange(selectionStart, selectionEnd);
    } else if (activeAction) {
      const replacement = [
        ...this.#root.querySelectorAll<HTMLElement>("[data-action]"),
      ].find(
        (element) =>
          element.dataset.action === activeAction &&
          (activeId === undefined || element.dataset.id === activeId),
      );
      replacement?.focus();
    }
  }
  #body(): string {
    const s = this.#state,
      o = this.#options;
    if (s.loading && !s.initialized)
      return `<div class="content empty" role="status">${escape(o.strings.loading)}</div>`;
    if (s.error && !s.initialized)
      return `<div class="content empty"><p>${escape(s.error)}</p><button class="primary" data-action="close">${escape(o.strings.close)}</button></div>`;
    if (s.view === "home")
      return `<div class="content home"><h2>${escape(this.#greeting)}</h2><p class="muted">Send us a message and continue any previous conversation.</p><button class="primary" data-action="new">${escape(o.strings.newConversation)}</button><button class="primary secondary" data-action="list">${escape(o.strings.conversations)} (${s.conversations.length})</button></div>`;
    if (s.view === "list")
      return `<div class="content"><h2>${escape(o.strings.conversations)}</h2>${s.conversations.length ? `<div class="rows">${s.conversations.map((c) => `<button class="row" data-action="conversation" data-id="${escape(c.id)}"><strong>${escape(c.subject ?? "Support conversation")}</strong><span>${escape(c.status.replaceAll("_", " "))}</span><small>${escape(formatDate(c.updatedAt))}</small></button>`).join("")}</div>` : `<div class="empty"><p>${escape(o.strings.noConversations)}</p><button class="primary" data-action="new">${escape(o.strings.newConversation)}</button></div>`}</div>`;
    if (s.view === "new") {
      const submission = s.pending[0];
      const submissionState = submission
        ? submission.status === "failed"
          ? `<div class="status error" role="alert">${escape(o.strings.messageFailed)} <button class="retry" data-action="retry" data-id="${escape(submission.clientMessageId)}">${escape(o.strings.retry)}</button></div>`
          : `<div class="status" role="status">Sending…</div>`
        : "";
      return `<div class="content home"><h2>${escape(o.strings.newConversation)}</h2><p class="muted">Tell us what you need help with.</p>${submissionState}${this.#composer()}</div>`;
    }
    const active = s.conversations.find((c) => c.id === s.activeId);
    const terminal =
      active?.status === "resolved" ||
      active?.status === "closed" ||
      active?.status === "spam";
    return `${s.loading ? `<div class="content empty" role="status">${escape(o.strings.loading)}</div>` : `<div class="content messages" role="log" aria-live="polite">${s.messages.length || s.pending.length ? [...s.messages.map((m) => `<div class="bubble ${isMine(m) ? "mine" : ""}">${escape(m.body)}${this.#messageFiles(m)}<small>${escape(formatDate(m.createdAt))}</small></div>`), ...s.pending.map((p) => `<div class="bubble mine pending ${p.status === "failed" ? "failed" : ""}">${escape(p.body)}<small>${p.status === "failed" ? `${escape(o.strings.messageFailed)} <button class="retry" data-action="retry" data-id="${escape(p.clientMessageId)}">${escape(o.strings.retry)}</button>` : "Sending…"}</small></div>`)].join("") : `<div class="empty">Send the first message in this conversation.</div>`}</div>`}${s.agentTyping ? `<div class="typing" role="status">An agent is typing…</div>` : ""}${s.newMessages ? `<button class="new" data-action="new-messages">${escape(o.strings.newMessages)}</button>` : ""}${terminal ? `<div class="status">${escape(o.strings.resolved)}</div>` : this.#composer()}`;
  }
  #messageFiles(message: CustomerMessage): string {
    if (!message.attachments?.length) return "";
    return `<div class="message-files">${message.attachments
      .map(
        (attachment) =>
          `<div class="file-card"><span>📎 ${escape(attachment.fileName)}</span><button data-action="download" data-id="${escape(attachment.id)}" aria-label="Download ${escape(attachment.fileName)}">Download</button></div>`,
      )
      .join("")}</div>`;
  }
  #composer(): string {
    const s = this.#state,
      o = this.#options;
    const disabled = s.connection === "offline";
    const uploads = s.uploads.length
      ? `<div class="upload-list" role="status" aria-label="Selected attachments">${s.uploads
          .map(
            (upload) =>
              `<div class="file-card"><span>${escape(upload.file.name)} (${Math.ceil(upload.file.size / 1024)} KB)</span>${upload.status === "uploading" ? `<progress value="${upload.progress}" max="100" aria-label="Uploading ${escape(upload.file.name)}: ${upload.progress}%"></progress>` : upload.status === "failed" ? `<span role="alert">${escape(upload.error ?? "Upload failed.")}</span><button data-action="retry-upload" data-id="${escape(upload.localId)}">Retry</button>` : `<span>Ready</span>`}<button data-action="remove-upload" data-id="${escape(upload.localId)}" aria-label="Remove ${escape(upload.file.name)}">Remove</button></div>`,
          )
          .join("")}</div>`
      : "";
    const canAttach = Boolean(this.#attachmentConfig && s.activeId);
    const sendDisabled =
      (!s.draft.trim() &&
        !s.uploads.some((upload) => upload.status === "ready")) ||
      s.uploads.some((upload) => upload.status === "uploading") ||
      disabled;
    return `<div class="composer">${uploads}${canAttach ? `<input type="file" hidden multiple accept="${escape(this.#attachmentConfig?.allowedMimeTypes.join(",") ?? "")}"><button class="attach" data-action="pick-files" aria-label="Attach files" ${disabled ? "disabled" : ""}>📎</button>` : ""}<div style="flex:1"><textarea rows="1" maxlength="${o.maxMessageLength}" aria-label="${escape(o.strings.writeMessage)}" placeholder="${escape(o.strings.writeMessage)}" ${disabled ? "disabled" : ""}>${escape(s.draft)}</textarea><div class="counter">${s.draft.length}/${o.maxMessageLength}</div></div><button class="send" data-action="send" ${sendDisabled ? "disabled" : ""}>${escape(o.strings.send)}</button></div>`;
  }
}

export function createSupportWidget(
  options: SupportWidgetOptions = {},
): SupportWidgetController {
  return new SupportWidgetController(options);
}
