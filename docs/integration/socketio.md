# Socket.IO realtime integration

Install `@crazyglegit/support-realtime-socketio`, `socket.io`, and
`socket.io-client`. Construct the public Support SDK first, configure a host-owned
Socket.IO server with exact CORS origins, a bounded `maxHttpBufferSize`, and secure
transports, then attach the adapter:

```ts
const support = await createSupportKit(config);
const io = new Server(httpServer, {
  cors: { origin: config.security.allowedOrigins, credentials: true },
  maxHttpBufferSize: 64 * 1024,
  transports: ["websocket"],
});
const realtime = createSupportSocketServer({
  io,
  support,
  options: {
    allowedOrigins: config.security.allowedOrigins,
    maxPayloadBytes: 64 * 1024,
  },
});
```

`createSupportSocketServer` attaches immediately; `attach()` is an idempotent
lifecycle method. `healthCheck()` reports attachment, disposal, and connection
state. `dispose()` removes connection/event listeners, clears typing timers,
disconnects adapter-managed sockets, and does not close the host-owned Socket.IO
or HTTP server.

## Authentication

The client supplies only an actor-kind hint (`customer`, `visitor`, or `agent`).
Credentials in `handshake.auth`, query data, headers, and cookies are passed as a
provider-neutral SDK authentication context. The host auth adapter must verify
them. The hint never supplies an actor ID, role, or permissions; the SDK resolves
and persists the verified internal actor. Authentication has a bounded timeout
and failures return only a sanitized connection error.

## Events and acknowledgements

Client events are `conversation.join`, `conversation.leave`, `message.send`,
`message.read`, `typing.start`, `typing.stop`, `conversation.assign`,
`conversation.status.change`, `conversation.reopen`, `conversation.spam`,
`internal_note.create`, `conversation.tag.add`, and `conversation.tag.remove`.
The final seven are agent-only.

Server events are `message.created`, `message.read`, `conversation.updated`,
`conversation.assigned`, `conversation.status_changed`, `internal_note.created`,
`conversation.tag_added`, `conversation.tag_removed`, `typing.updated`,
`presence.updated`, and `support.error`.

Every client event accepts an acknowledgement callback. Success is
`{ ok: true, data, requestId }`; failure is
`{ ok: false, error: { code, message, requestId } }`. Errors never contain raw
SDK/provider errors or stack traces. Durable server events use
`{ eventId, eventType, version, occurredAt, conversationId?, data }`; project ID
is intentionally absent because one adapter instance is bound to one SDK project.

## Reconnection and resynchronization

A reconnect performs authentication again and restores only actor-level rooms.
Clients explicitly issue `conversation.join` again, which repeats authorization.
Socket.IO notifications are not history: after reconnect, fetch the conversation
and missed messages through the HTTP API, reconcile by durable IDs, then resume
live events. Retrying `message.send` with the same `clientMessageId` is safe.

Message-created payloads may include sanitized ready attachment cards. They never
contain bytes, storage keys, bucket data, scanner diagnostics, or signed URLs.
Uploads and downloads always use the authorized HTTP/S3 flow.

The Phase 7 adapter is correct for one Node process. Socket.IO's adapter boundary
allows a future Redis adapter or broker, but guaranteed database-to-broker delivery
requires a transactional outbox and is not part of this phase.
