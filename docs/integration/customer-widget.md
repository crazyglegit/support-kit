# Customer widget integration

Install `@crazyglegit/support-widget` for framework-independent use or `@crazyglegit/support-react` for React. Mounting the React component is sufficient; consumers do not provide chat screens, state stores, Tailwind configuration, fonts, or global CSS.

```tsx
<SupportWidget
  apiBaseUrl="/api/support"
  socketUrl={process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL}
/>
```

```ts
const widget = createSupportWidget({
  apiBaseUrl: "/api/support",
  socketUrl: window.location.origin,
});
```

## Isolation and lifecycle

Every controller creates its own Shadow root, HTTP client, socket, event set, timers, drafts, and UI state. Styles are bundled inside the shadow root and use a system font. Instances have no singleton state. `destroy()` or React unmount aborts requests, stops typing, removes socket/listeners/timers, and removes the host element. React initializes only in an effect and cleans up Strict Mode development remounts.

## Configuration

Supported options include `apiBaseUrl`, `socketUrl`, left/right position, light/dark/system theme, title, greeting, launcher label, six-digit hex accent, locale, string overrides, fetch credentials, bounded z-index, message length, timeout, safe theme variables, and panel dimensions. Identity, project, role, permissions, database values, and secrets are intentionally impossible to configure.

Precedence is: package defaults, then public server widget configuration, then safe local presentation overrides. This is tested for title, greeting, launcher label, position, theme, and accent color. Server feature availability is authoritative. CSS values are validated and arbitrary CSS is rejected. Endpoint values must be relative paths or HTTP(S) URLs without embedded credentials, query strings, or fragments. English is included; visible strings may be overridden without enabling a separate translation runtime.

## Authentication and transport

`POST /session` asks the host authentication adapter for an authenticated customer and then a verified visitor. The browser sends credentials according to `credentials` (`same-origin` by default); it stores no token and exposes no identity through widget events. A changed or expired identity requires a new controller/bootstrap, which starts with empty private state. Hosts must not silently treat an unverified browser identifier as a visitor session.

HTTP is authoritative for configuration, conversations, history, creation, messages, and receipts. Socket.IO connects only after session resolution. Joins are acknowledged after server authorization. Version-1 public envelopes are deduplicated; unknown versions and invalid message shapes are ignored. Reconnect reauthenticates, rejoins, fetches current detail/history, and reconciles durable IDs and `clientMessageId`. When realtime is unavailable, durable HTTP sending remains available and the UI identifies the degraded state.

Each logical send receives one UUID. Its optimistic item keeps that UUID through failure and retry, so the server's idempotency constraint returns the original durable message after ambiguous failures. Draft text is restored on failure. Enter sends; Shift+Enter inserts a line break.

Messages remain plain text. HTML, scripts, embedded media, and automatic links are not created. URL-like text therefore remains inert; if safe link detection is added later, it must use an allowlisted parser and `noopener noreferrer` behavior.

## Accessibility and mobile

The launcher, navigation, composer, retry, and close controls are semantic and keyboard accessible. Escape minimizes, focus enters the panel on open and returns on close, incoming messages and connection state use live regions, focus indicators are visible, and reduced-motion preferences disable motion. At narrow viewports the panel uses the dynamic viewport and safe-area insets; the composer remains reachable without modifying host global styles or body scroll.

## Troubleshooting

- Authentication errors: verify the host customer/visitor adapter and credential cookies.
- Mutations rejected: add the exact application origin to `security.allowedOrigins`.
- No live updates: provide the Socket.IO URL, matching exact origin/CORS settings, and the same verified session credentials. HTTP remains usable.
- No history: verify customer participation and project initialization; foreign resources intentionally appear not found.
- Raw server details never appear in the UI. Use the server-side request ID from controlled logs for diagnosis.

Run `pnpm --filter @crazyglegit/support-widget size` for raw and gzip sizes of all emitted widget modules. The report labels dependencies as external; a host bundler includes/deduplicates `socket.io-client` and Zod. The full UI currently ships in the widget entry (there is no separate loader chunk); consumers should load/mount it near application hydration. React is a peer dependency, and no dashboard or server package is bundled.
