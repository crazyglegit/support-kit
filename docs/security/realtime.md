# Realtime security

Use exact `allowedOrigins` in both the host Socket.IO CORS configuration and the
support adapter. Missing or non-matching origins are rejected. Configure
`maxHttpBufferSize` on Socket.IO and `maxPayloadBytes` on the adapter. Production
hosts should use secure cookies or short-lived handshake credentials, TLS, and the
WebSocket transport where their deployment supports it.

Connection authentication is time-bounded. Optional connection and event
rate-limit hooks allow a host limiter without embedding Redis in this package.
Typing is throttled and automatically expires. Neither tokens/cookies nor message
content are logged by the adapter.

The client cannot provide project ID, internal actor ID, role, permissions, or a
room name. Every join and mutation is authorized by the public SDK. Foreign-project
and unauthorized customer resources appear as `NOT_FOUND`. Agent-only events still
pass exact SDK permission checks. Internal notes use a distinct room and are never
serialized to customer or visitor sockets.

All payloads use strict Zod schemas with bounded identifiers, content, and status
values. Unknown fields, malformed inputs, unsupported events, and oversized
payloads fail with sanitized errors. Application output is treated as untrusted
and serialized through explicit field allowlists.
