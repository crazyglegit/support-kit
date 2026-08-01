# Secure attachment architecture

Attachments are disabled unless an attachment policy and private storage adapter are configured. PostgreSQL is the lifecycle source of truth; S3-compatible storage contains opaque private objects only.

The flow is: verified actor requests an upload intent, the SDK authorizes the conversation and persists `pending_upload`, the storage adapter signs a short-lived PUT, the browser uploads directly without credentials, and HTTP completion verifies object metadata and invokes the configured scanner. Only `ready` attachments can be atomically claimed by a message.

Lifecycle states are `pending_upload`, `uploaded`, `scanning`, `ready`, `rejected`, `failed`, and `deleted`. Scan states are `pending`, `clean`, `infected`, `suspicious`, `failed`, and `skipped`. Storage and scanning calls occur outside long database transactions. Message creation and attachment claiming occur together in a short project-scoped transaction.

Object keys use `support/{projectId}/{conversationId}/{attachmentId}/{randomUUID}` and never contain filenames. Public serializers expose only ID, normalized display name, detected MIME category, byte size, and ready status. Storage keys, bucket details, checksums, uploader IDs, scan diagnostics, and signed URLs are excluded.

Realtime message events may contain the same sanitized attachment cards as HTTP. File bytes and signed URLs never use Socket.IO. Reconnect continues to resynchronize durable messages and attachments through HTTP.
