# Public contracts

`@crazyglegit/support-contracts` contains Zod schemas and inferred transport
types shared by clients and servers. It is framework-independent.

Public schemas cover identities, conversation/message values, permissions,
pagination, API envelopes, realtime event envelopes, widget settings, feature
flags, and security configuration. Transport timestamps use ISO 8601 strings
with explicit timezone information.

API responses use either `{ success: true, data }` or
`{ success: false, error }`. Error codes are stable and include validation,
authentication, authorization, lookup, conflict, rate limiting, lifecycle, and
internal failures. `createApiSuccessEnvelopeSchema` and
`createRealtimeEventEnvelopeSchema` preserve payload-specific runtime
validation.

Adapter ports are TypeScript interfaces rather than Zod schemas. Provider
implementations remain opaque to runtime configuration validation.

Socket.IO contracts add strict client payload schemas, acknowledgement schemas,
public client/server event-name enums, and a project-implicit event envelope with
`eventId`, `eventType`, `version`, `occurredAt`, optional `conversationId`, and
sanitized `data`. The earlier provider-neutral realtime envelope remains available
for adapter compatibility.
