# Phase 10 attachment testing

Unit and component suites cover configuration, filename safety, MIME/size policy, scan failure, idempotent association, mode isolation, S3 validation/signing, upload progress/cancellation, safe cards, and authorized downloads. Existing widget, dashboard, HTTP, realtime, Strict Mode, SSR, security, and accessibility regressions remain mandatory.

`pnpm test:integration` starts PostgreSQL and MinIO test services. It applies migrations from an empty database, exercises project-scoped attachment persistence and transactions, and verifies real presigned PUT/stat/GET/delete behavior without production buckets.

The example development scanner deliberately returns a clean fixture result and must never be used as evidence of malware safety in production.
