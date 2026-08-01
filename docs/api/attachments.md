# Attachment SDK and HTTP API

The public SDK group is `support.attachments`:

- `createUploadIntent({ actor, conversationId, fileName, mimeType, sizeBytes, purpose? })`
- `completeUpload({ actor, conversationId, attachmentId })`
- `deletePending({ actor, conversationId, attachmentId })`
- `getDownload({ actor, conversationId, attachmentId })`

Customer and visitor HTTP routes are `POST /attachments/upload-intents`, `POST /attachments/{id}/complete`, `DELETE /attachments/{id}`, and `GET /attachments/{id}/download`. Agent routes use the same suffixes beneath `/agent/attachments`. Completion, deletion, and download receive `conversationId` as a query parameter; project and actor scope always come from the verified server boundary.

Message and internal-note bodies accept `attachmentIds`. Content may be empty only when at least one attachment is supplied. Retrying the same `clientMessageId` must supply the identical attachment set.

Stable attachment errors include `ATTACHMENTS_DISABLED`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`, `TOO_MANY_ATTACHMENTS`, `ATTACHMENT_NOT_READY`, `ATTACHMENT_REJECTED`, `ATTACHMENT_ALREADY_ATTACHED`, `UPLOAD_EXPIRED`, `UPLOAD_NOT_FOUND`, `UPLOAD_VERIFICATION_FAILED`, `MALWARE_DETECTED`, `SCAN_FAILED`, and `STORAGE_UNAVAILABLE`.
