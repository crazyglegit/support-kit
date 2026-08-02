# Phase 12 verification

The Phase 12 suites cover strict configuration and provider output, deterministic chunking, published-only project-scoped retrieval, knowledge permissions, session ownership, citation allowlisting, uncertainty behavior, handoff idempotency, HTTP serialization, and escaped widget rendering. Existing widget, dashboard, authorization, realtime, and attachment suites remain regression gates.

Required release checks are the workspace build, lint, typecheck, unit tests, format check, integration suite, Playwright suite, demo production build, database migration tests, HTTP/realtime tests, and widget/dashboard bundle reports. Provider-live tests are optional and must be explicitly enabled with credentials; deterministic adapters remain the default CI path.
