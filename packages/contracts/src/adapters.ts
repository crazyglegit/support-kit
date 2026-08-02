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
export interface CreateUploadTargetInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly attachmentId: string;
  readonly storageKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly expiresInSeconds: number;
}

/** A provider-neutral upload destination. */
export interface UploadTarget {
  readonly method: "PUT";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

export interface StoredObjectMetadata {
  readonly sizeBytes: number;
  readonly contentType?: string;
  readonly checksumSha256?: string;
}

export interface CreateDownloadUrlInput {
  readonly storageKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly expiresInSeconds: number;
}

/** Provider-neutral private object storage boundary. */
export interface SupportStorageAdapter extends SupportAdapterLifecycle {
  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget>;
  statObject(storageKey: string): Promise<StoredObjectMetadata>;
  createDownloadUrl(
    input: CreateDownloadUrlInput,
  ): Promise<{ readonly url: string; readonly expiresAt: string }>;
  deleteObject(storageKey: string): Promise<void>;
}

export interface AttachmentScanInput {
  readonly projectId: string;
  readonly attachmentId: string;
  readonly storage: SupportStorageAdapter;
  readonly storageKey: string;
  readonly claimedMimeType: string;
  readonly expectedSizeBytes: number;
}
export interface AttachmentScanResult {
  readonly verdict: "clean" | "infected" | "suspicious" | "failed";
  readonly detectedMimeType?: string;
  readonly sizeBytes: number;
  readonly checksumSha256?: string;
  readonly reasonCode?: string;
}
export interface AttachmentScannerAdapter extends SupportAdapterLifecycle {
  scan(input: AttachmentScanInput): Promise<AttachmentScanResult>;
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
  generateChatbotAnswer?(
    input: ChatbotGenerationInput,
  ): Promise<ChatbotGenerationResult>;
  generateHandoffSummary?(
    input: ChatbotHandoffSummaryInput,
  ): Promise<ChatbotHandoffSummaryResult>;
}

export interface RetrievedKnowledgeContext {
  readonly sourceKey: string;
  readonly title: string;
  readonly section?: string;
  readonly content: string;
}
export interface ChatbotGenerationInput {
  readonly systemPolicy: string;
  readonly message: string;
  readonly conversation: readonly {
    readonly actorType: "customer" | "visitor" | "bot";
    readonly content: string;
  }[];
  readonly knowledge: readonly RetrievedKnowledgeContext[];
  readonly allowedCitationSourceKeys: readonly string[];
  readonly maximumOutputCharacters: number;
}
export interface ChatbotGenerationResult {
  readonly answer: string;
  readonly citedSourceKeys: readonly string[];
  readonly shouldEscalate: boolean;
  readonly escalationReason?: string;
  readonly modelReference?: string;
}
export interface ChatbotHandoffSummaryInput {
  readonly transcript: readonly {
    readonly actorType: "customer" | "visitor" | "bot";
    readonly content: string;
  }[];
  readonly citedSourceKeys: readonly string[];
  readonly maximumOutputCharacters: number;
}
export interface ChatbotHandoffSummaryResult {
  readonly summary: string;
  readonly unresolvedQuestions: readonly string[];
}
export interface EmbeddingAdapter extends SupportAdapterLifecycle {
  readonly dimensions: number;
  embed(input: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export type { SupportDatabaseAdapter };
