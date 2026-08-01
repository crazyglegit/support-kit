# Phase 8 widget testing

Focused commands:

```bash
pnpm --filter @crazyglegit/support-widget test
pnpm --filter @crazyglegit/support-nextjs test
pnpm --filter @crazyglegit/support-realtime-socketio test
pnpm test:e2e
pnpm --filter @crazyglegit/support-widget size
```

Widget unit/component tests cover browser package boundaries, minimal exports, defaults, forbidden identity/secret configuration, endpoint validation, localization, HTTP error mapping and abort cleanup, authenticated and visitor bootstrap ordering, creation double-submit and retry idempotency, send retry, realtime deduplication, reconnect resync, HTTP fallback, history restoration, strict message escaping, internal-note DOM/event exclusion, configuration precedence, Shadow DOM isolation, lifecycle/focus, typing throttling, receipt deduplication, multiple-instance isolation, and idempotent disposal. React tests cover Strict Mode single initialization, imperative methods, cleanup, and real SSR import/render without browser globals. HTTP adapter tests cover session fallback/failure, exact origin rejection, the configuration endpoint, and customer allowlist filtering. Existing realtime integration tests cover authentication, authorization, idempotency, receipts, typing, reconnection primitives, and internal-note room isolation.

Playwright covers mounting, launcher operation, keyboard/Escape focus restoration, mobile viewport, system dark mode, and reduced motion. Full conversation E2E requires a migrated disposable PostgreSQL database and a running host-owned Socket.IO server; the demo intentionally does not embed a production dashboard or a second message transport.
