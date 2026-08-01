# Attachment security

Every intent, completion, association, deletion, and download repeats project and conversation authorization. Attachment IDs are locators, not capabilities. Foreign-project and unauthorized resources are returned as not found where appropriate.

Original filenames are NFKC-normalized for display, stripped of controls and path separators, bounded, and never used as storage keys. SVG, HTML, JavaScript, executables, archives, macro-enabled documents, unknown binary types, and files without a trustworthy detected type are rejected by the default policy. Claimed size and MIME are checked against stored and scanner-detected metadata.

Only clean `ready` objects are downloadable under required scanning. Rejected and failed objects remain blocked even if object deletion fails. Temporary GET URLs are created only after authorization and are never persisted in messages or realtime events.

Internal-note uploads are marked `internal_note` at intent creation. Atomic claiming requires the attachment visibility to match the message type, preventing reply/note mode confusion. Customer serializers, customer realtime rooms, download authorization, widget state, and DOM rendering all exclude internal-note attachments.

Deployment checklist: private bucket/public-access block, least-privilege credentials, TLS, exact CORS origins, short URL TTLs, production scanner, encryption policy, lifecycle cleanup for abandoned uploads, migration applied explicitly, upload/completion rate limiting at the host boundary, and no provider errors or signed URLs in logs.
