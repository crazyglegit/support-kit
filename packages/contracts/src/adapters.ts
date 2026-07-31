import type { SupportDatabaseAdapter } from "@crazyglegit/support-core";
import type {
  AgentIdentity,
  CustomerIdentity,
  VisitorIdentity,
} from "./identities.js";
import type { RealtimeEventEnvelope } from "./realtime.js";

/** Optional health result exposed by a host adapter without forcing network I/O. */
export interface AdapterHealthResult {
  readonly status: "healthy" | "unhealthy";
  readonly message?: string;
}

/** Optional lifecycle capabilities shared by provider-neutral adapters. */
export interface SupportAdapterLifecycle {
  healthCheck?(): Promise<AdapterHealthResult>;
  dispose?(): Promise<void>;
}

/** Provider-neutral request information passed to host authentication. */
export interface SupportAuthContext {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Transport-specific credentials for host verification (for example Socket.IO auth). */
  readonly data?: unknown;
}

/** Host-owned identity lookup boundary. */
export interface SupportAuthAdapter extends SupportAdapterLifecycle {
  getCustomer(context: SupportAuthContext): Promise<CustomerIdentity | null>;
  getVisitor(context: SupportAuthContext): Promise<VisitorIdentity | null>;
  getAgent(context: SupportAuthContext): Promise<AgentIdentity | null>;
}

/** Provider-neutral realtime publishing and authorization boundary. */
export interface SupportRealtimeAdapter extends SupportAdapterLifecycle {
  publish(channel: string, event: RealtimeEventEnvelope): Promise<void>;
  authorize(actorId: string, channel: string): Promise<boolean>;
  disconnectSession?(sessionId: string): Promise<void>;
}

/** Input for a provider-neutral upload request. */
export interface CreateUploadInput {
  readonly projectId: string;
  readonly fileName: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
}

/** A provider-neutral upload destination. */
export interface UploadTarget {
  readonly uploadId: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** Provider-neutral private object storage boundary. */
export interface SupportStorageAdapter extends SupportAdapterLifecycle {
  createUpload(input: CreateUploadInput): Promise<UploadTarget>;
  createDownloadUrl(fileId: string): Promise<string>;
  deleteFile(fileId: string): Promise<void>;
}

/** Provider-neutral notification payload. */
export interface SupportNotification {
  readonly projectId: string;
  readonly recipientId: string;
  readonly eventType: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Provider-neutral notification delivery boundary. */
export interface SupportNotificationAdapter extends SupportAdapterLifecycle {
  notifyAgent(notification: SupportNotification): Promise<void>;
  notifyCustomer(notification: SupportNotification): Promise<void>;
}

/** Provider-neutral AI draft request. */
export interface SupportAIDraftInput {
  readonly instruction: string;
  readonly content: string;
  readonly context?: readonly string[];
}

/** Validated provider-neutral AI draft result. */
export interface SupportAIDraftResult {
  readonly content: string;
}

/** Narrow boundary for optional agent-controlled AI drafting. */
export interface SupportAIAdapter extends SupportAdapterLifecycle {
  generateDraft(input: SupportAIDraftInput): Promise<SupportAIDraftResult>;
}

export type { SupportDatabaseAdapter };
