# Phase 9 dashboard testing

Focused commands are `pnpm --filter @crazyglegit/support-dashboard test`, React, Next.js HTTP, realtime, widget regression, Playwright, and dashboard size checks.

Automated tests cover configuration authority rejection, browser boundaries, reconciliation, authenticated initialization order, permission-aware controls, note isolation, safe plain-text rendering, multiple instances, idempotent cleanup, React Strict Mode, SSR, HTTP allowlists, realtime authorization, and widget regression.

They also cover reply/note route isolation, viewer read-only behavior, idempotent failed-send retry, reconnect HTTP resync, identity-change and expired-session clearing, server-derived self-assignment, lifecycle/tag/receipt transport mapping, and authorization errors.

Manual WCAG checks remain required for screen-reader/browser combinations, 200–400% zoom, high-contrast modes, and mobile virtual keyboards across supported devices.
