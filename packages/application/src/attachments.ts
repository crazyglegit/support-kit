import {
  DomainError,
  isCustomerVisibleMessage,
  type AttachmentMetadata,
} from "@crazyglegit/support-core";
import { requireConversationAccess } from "./helpers.js";
import type { ApplicationDependencies, ConversationActor } from "./types.js";

export interface AttachmentPolicy {
  readonly enabled: boolean;
  readonly maxFileSizeBytes: number;
  readonly maxFilesPerMessage: number;
  readonly allowedMimeTypes: readonly string[];
  readonly uploadUrlTtlSeconds: number;
  readonly downloadUrlTtlSeconds: number;
  readonly scanPolicy: "required" | "optional" | "disabled";
}
export interface AttachmentStoragePort {
  createUploadTarget(input: {
    projectId: string;
    conversationId: string;
    attachmentId: string;
    storageKey: string;
    contentType: string;
    sizeBytes: number;
    expiresInSeconds: number;
  }): Promise<{
    method: "PUT";
    url: string;
    headers: Readonly<Record<string, string>>;
    expiresAt: string;
  }>;
  statObject(storageKey: string): Promise<{
    sizeBytes: number;
    contentType?: string;
    checksumSha256?: string;
  }>;
  createDownloadUrl(input: {
    storageKey: string;
    fileName: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: string }>;
  deleteObject(storageKey: string): Promise<void>;
}
export interface AttachmentScannerPort {
  scan(input: {
    projectId: string;
    attachmentId: string;
    storage: AttachmentStoragePort;
    storageKey: string;
    claimedMimeType: string;
    expectedSizeBytes: number;
  }): Promise<{
    verdict: "clean" | "infected" | "suspicious" | "failed";
    detectedMimeType?: string;
    sizeBytes: number;
    checksumSha256?: string;
    reasonCode?: string;
  }>;
}
export interface AttachmentDependencies extends ApplicationDependencies {
  readonly storage: AttachmentStoragePort;
  readonly scanner?: AttachmentScannerPort;
  readonly policy: AttachmentPolicy;
}
export interface AttachmentActorInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly actor: ConversationActor;
}

export function normalizeAttachmentFilename(value: string): string {
  const withoutControls = Array.from(value.normalize("NFKC"))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 0x1f && (codePoint < 0x7f || codePoint > 0x9f);
    })
    .join("");
  const normalized = withoutControls
    .replace(/[\\/]+/gu, "-")
    .replace(/\.\.+/gu, ".")
    .trim();
  const safe = normalized
    .slice(0, 255)
    .replace(/^[.\s-]+/u, "")
    .trim();
  return safe || "attachment";
}

function ensureEnabled(dependencies: AttachmentDependencies): void {
  if (!dependencies.policy.enabled)
    throw new DomainError(
      "ATTACHMENTS_DISABLED",
      "Attachments are not available.",
    );
}
function safeAttachment(entity: AttachmentMetadata) {
  return {
    id: entity.id,
    fileName: entity.safeDisplayFilename,
    mediaType: entity.detectedMimeType ?? entity.claimedMimeType,
    sizeBytes: entity.sizeBytes,
    status: entity.status,
  } as const;
}
async function persistAttachmentTransition(
  dependencies: AttachmentDependencies,
  attachment: AttachmentMetadata,
  actor: ConversationActor,
  action: string,
): Promise<AttachmentMetadata> {
  return dependencies.database.transaction(async (database) => {
    const saved = await database.attachments.save(attachment);
    await database.audit.append({
      id: dependencies.ids.generate(),
      projectId: attachment.projectId,
      action,
      actorId: actor.id,
      actorType: actor.type,
      resourceId: attachment.id,
      resourceType: "attachment",
      metadata: {
        status: attachment.status,
        scanStatus: attachment.scanStatus,
      },
      createdAt: attachment.updatedAt,
      updatedAt: attachment.updatedAt,
    });
    return saved;
  });
}

export class CreateAttachmentUploadIntent {
  public constructor(private readonly dependencies: AttachmentDependencies) {}
  public async execute(
    input: AttachmentActorInput & {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      purpose?: "reply" | "internal_note";
    },
  ) {
    ensureEnabled(this.dependencies);
    const visibility =
      input.actor.type === "agent" && input.purpose === "internal_note"
        ? "internal_note"
        : "public";
    await requireConversationAccess(
      this.dependencies.database,
      input.projectId,
      input.conversationId,
      input.actor,
      visibility === "internal_note"
        ? "internal_note.create"
        : "conversation.reply",
    );
    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0)
      throw new DomainError("VALIDATION_ERROR", "File size is invalid.");
    if (input.sizeBytes > this.dependencies.policy.maxFileSizeBytes)
      throw new DomainError(
        "FILE_TOO_LARGE",
        "The selected file is too large.",
      );
    if (!this.dependencies.policy.allowedMimeTypes.includes(input.mimeType))
      throw new DomainError(
        "FILE_TYPE_NOT_ALLOWED",
        "This file type is not allowed.",
      );
    const now = this.dependencies.clock.now();
    const id = this.dependencies.ids.generate();
    const storageKey = `support/${input.projectId}/${input.conversationId}/${id}/${this.dependencies.ids.generate()}`;
    const attachment: AttachmentMetadata = {
      id,
      projectId: input.projectId,
      conversationId: input.conversationId,
      uploaderType: input.actor.type,
      uploaderId: input.actor.id,
      storageKey,
      visibility,
      originalFilename: input.fileName,
      safeDisplayFilename: normalizeAttachmentFilename(input.fileName),
      claimedMimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: "pending_upload",
      scanStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await this.dependencies.database.transaction(async (database) => {
      await database.attachments.save(attachment);
      await database.audit.append({
        id: this.dependencies.ids.generate(),
        projectId: input.projectId,
        action: "attachment.upload_intent.created",
        actorId: input.actor.id,
        actorType: input.actor.type,
        resourceId: id,
        resourceType: "attachment",
        metadata: { conversationId: input.conversationId },
        createdAt: now,
        updatedAt: now,
      });
    });
    try {
      const upload = await this.dependencies.storage.createUploadTarget({
        projectId: input.projectId,
        conversationId: input.conversationId,
        attachmentId: id,
        storageKey,
        contentType: input.mimeType,
        sizeBytes: input.sizeBytes,
        expiresInSeconds: this.dependencies.policy.uploadUrlTtlSeconds,
      });
      await this.dependencies.database.attachments.save({
        ...attachment,
        uploadExpiresAt: new Date(upload.expiresAt),
        updatedAt: this.dependencies.clock.now(),
      });
      return { attachment: safeAttachment(attachment), upload };
    } catch {
      await this.dependencies.database.attachments.save({
        ...attachment,
        status: "failed",
        updatedAt: this.dependencies.clock.now(),
      });
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "File storage is unavailable.",
      );
    }
  }
}

async function authorizedAttachment(
  dependencies: AttachmentDependencies,
  input: AttachmentActorInput & { attachmentId: string },
) {
  await requireConversationAccess(
    dependencies.database,
    input.projectId,
    input.conversationId,
    input.actor,
    "conversation.read",
  );
  const attachment = await dependencies.database.attachments.findById({
    projectId: input.projectId,
    id: input.attachmentId,
  });
  if (attachment?.conversationId !== input.conversationId)
    throw new DomainError("NOT_FOUND", "Attachment was not found.");
  if (
    input.actor.type !== "agent" &&
    attachment.uploaderId !== input.actor.id &&
    !attachment.messageId
  )
    throw new DomainError("NOT_FOUND", "Attachment was not found.");
  return attachment;
}

export class CompleteAttachmentUpload {
  public constructor(private readonly dependencies: AttachmentDependencies) {}
  public async execute(input: AttachmentActorInput & { attachmentId: string }) {
    ensureEnabled(this.dependencies);
    let attachment = await authorizedAttachment(this.dependencies, input);
    if (attachment.status === "ready") return safeAttachment(attachment);
    if (
      attachment.uploadExpiresAt &&
      attachment.uploadExpiresAt.getTime() <
        this.dependencies.clock.now().getTime()
    )
      throw new DomainError("UPLOAD_EXPIRED", "The upload intent has expired.");
    if (
      attachment.status !== "pending_upload" &&
      attachment.status !== "uploaded"
    )
      throw new DomainError(
        "ATTACHMENT_REJECTED",
        "The attachment cannot be completed.",
      );
    let stored;
    try {
      stored = await this.dependencies.storage.statObject(
        attachment.storageKey,
      );
    } catch {
      throw new DomainError(
        "UPLOAD_NOT_FOUND",
        "The uploaded file was not found.",
      );
    }
    if (stored.sizeBytes !== attachment.sizeBytes) {
      attachment = await this.reject(
        attachment,
        input.actor,
        "size_mismatch",
        "failed",
      );
      try {
        await this.dependencies.storage.deleteObject(attachment.storageKey);
      } catch {
        /* remains rejected */
      }
      throw new DomainError(
        "UPLOAD_VERIFICATION_FAILED",
        "The uploaded file did not match the request.",
      );
    }
    if (
      stored.contentType &&
      stored.contentType !== attachment.claimedMimeType
    ) {
      await this.reject(attachment, input.actor, "mime_mismatch", "failed");
      try {
        await this.dependencies.storage.deleteObject(attachment.storageKey);
      } catch {
        /* remains rejected */
      }
      throw new DomainError(
        "UPLOAD_VERIFICATION_FAILED",
        "The uploaded file did not match the request.",
      );
    }
    const now = this.dependencies.clock.now();
    attachment = await this.dependencies.database.attachments.save({
      ...attachment,
      status: "uploaded",
      uploadedAt: now,
      updatedAt: now,
    });
    if (this.dependencies.policy.scanPolicy === "disabled") {
      return safeAttachment(
        await persistAttachmentTransition(
          this.dependencies,
          {
            ...attachment,
            status: "ready",
            scanStatus: "skipped",
            detectedMimeType: stored.contentType ?? attachment.claimedMimeType,
            ...(stored.checksumSha256
              ? { checksumSha256: stored.checksumSha256 }
              : {}),
            scannedAt: now,
            updatedAt: now,
          },
          input.actor,
          "attachment.ready",
        ),
      );
    }
    if (!this.dependencies.scanner)
      throw new DomainError("SCAN_FAILED", "File scanning is unavailable.");
    attachment = await this.dependencies.database.attachments.save({
      ...attachment,
      status: "scanning",
      updatedAt: now,
    });
    let result;
    try {
      result = await this.dependencies.scanner.scan({
        projectId: input.projectId,
        attachmentId: attachment.id,
        storage: this.dependencies.storage,
        storageKey: attachment.storageKey,
        claimedMimeType: attachment.claimedMimeType,
        expectedSizeBytes: attachment.sizeBytes,
      });
    } catch {
      result = { verdict: "failed" as const, sizeBytes: attachment.sizeBytes };
    }
    const detected = result.detectedMimeType;
    if (
      result.verdict !== "clean" ||
      result.sizeBytes !== attachment.sizeBytes ||
      !detected ||
      !this.dependencies.policy.allowedMimeTypes.includes(detected) ||
      detected !== attachment.claimedMimeType
    ) {
      const scanStatus =
        result.verdict === "infected"
          ? "infected"
          : result.verdict === "suspicious"
            ? "suspicious"
            : "failed";
      await this.reject(
        attachment,
        input.actor,
        result.verdict === "infected" ? "malware_detected" : "scan_failed",
        scanStatus,
      );
      try {
        await this.dependencies.storage.deleteObject(attachment.storageKey);
      } catch {
        /* remains rejected */
      }
      throw new DomainError(
        result.verdict === "infected" ? "MALWARE_DETECTED" : "SCAN_FAILED",
        "The file did not pass security scanning.",
      );
    }
    const completed = await persistAttachmentTransition(
      this.dependencies,
      {
        ...attachment,
        status: "ready",
        scanStatus: "clean",
        detectedMimeType: detected,
        sizeBytes: result.sizeBytes,
        ...(result.checksumSha256
          ? { checksumSha256: result.checksumSha256 }
          : {}),
        scannedAt: this.dependencies.clock.now(),
        updatedAt: this.dependencies.clock.now(),
      },
      input.actor,
      "attachment.ready",
    );
    return safeAttachment(completed);
  }
  private reject(
    attachment: AttachmentMetadata,
    actor: ConversationActor,
    reason: string,
    scanStatus: AttachmentMetadata["scanStatus"],
  ) {
    const now = this.dependencies.clock.now();
    return persistAttachmentTransition(
      this.dependencies,
      {
        ...attachment,
        status: "rejected",
        scanStatus,
        rejectionReasonCode: reason,
        scannedAt: now,
        updatedAt: now,
      },
      actor,
      "attachment.rejected",
    );
  }
}

export class DeletePendingAttachment {
  public constructor(private readonly dependencies: AttachmentDependencies) {}
  public async execute(
    input: AttachmentActorInput & { attachmentId: string },
  ): Promise<void> {
    const attachment = await authorizedAttachment(this.dependencies, input);
    if (attachment.messageId)
      throw new DomainError(
        "ATTACHMENT_ALREADY_ATTACHED",
        "Attached files cannot be removed this way.",
      );
    if (attachment.uploaderId !== input.actor.id)
      throw new DomainError("NOT_FOUND", "Attachment was not found.");
    try {
      await this.dependencies.storage.deleteObject(attachment.storageKey);
    } catch {
      /* deletion remains fail-closed */
    }
    const now = this.dependencies.clock.now();
    await persistAttachmentTransition(
      this.dependencies,
      { ...attachment, status: "deleted", deletedAt: now, updatedAt: now },
      input.actor,
      "attachment.deleted",
    );
  }
}

export class GetAttachmentDownload {
  public constructor(private readonly dependencies: AttachmentDependencies) {}
  public async execute(input: AttachmentActorInput & { attachmentId: string }) {
    const attachment = await authorizedAttachment(this.dependencies, input);
    if (attachment.status !== "ready" || !attachment.messageId)
      throw new DomainError(
        "ATTACHMENT_NOT_READY",
        "The attachment is not available.",
      );
    const message = await this.dependencies.database.messages.findById({
      projectId: input.projectId,
      id: attachment.messageId,
    });
    if (
      !message ||
      (input.actor.type !== "agent" && !isCustomerVisibleMessage(message))
    )
      throw new DomainError("NOT_FOUND", "Attachment was not found.");
    try {
      return await this.dependencies.storage.createDownloadUrl({
        storageKey: attachment.storageKey,
        fileName: attachment.safeDisplayFilename,
        contentType: attachment.detectedMimeType ?? attachment.claimedMimeType,
        expiresInSeconds: this.dependencies.policy.downloadUrlTtlSeconds,
      });
    } catch {
      throw new DomainError(
        "STORAGE_UNAVAILABLE",
        "The download is temporarily unavailable.",
      );
    }
  }
}
