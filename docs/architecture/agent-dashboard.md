# Agent dashboard architecture

The Phase 9 dashboard is a framework-independent browser controller rendered under a `.sk-dashboard` root. The React package owns only mount/unmount lifecycle. Each instance owns its HTTP client, Socket.IO client, event dedupe set, drafts, filters, and DOM; there is no singleton.

Bootstrap is sequential: resolve `/agent/session`, verify `conversation.read`, fetch the agent inbox, then connect Socket.IO with only the `agent` actor-kind hint. HTTP is durable truth. Realtime events are versioned notifications. Reconnect reauthenticates, rejoins the active conversation, and refetches inbox and active history.

Reconnect re-resolves the HTTP agent session before any room is rejoined. A changed or expired identity clears conversations, messages, drafts, receipt IDs, event IDs, typing state, and the active selection. “Assigned to me” and self-assignment are server-derived operations; the browser never places the verified agent ID in a filter URL or assignment body.

Reply and internal-note modes use distinct routes, permission gates, visual labels, and drafts. Both reconcile optimistic entries using `clientMessageId` and durable message ID. Internal-note events are discarded without `internal_note.read`.

Failed sends retain their original `clientMessageId` for idempotent retry. Stale detail responses are discarded after navigation, disposal, or identity changes.

Desktop uses inbox, conversation, and context columns. Tablet hides context into the primary workflow; mobile shows one pane at a time. CSS is fully prefixed beneath the stable dashboard root, requires no host Tailwind, and responds to system theme, safe areas, zoom, and reduced motion.
