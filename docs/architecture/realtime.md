# Realtime architecture

`@crazyglegit/support-realtime-socketio` is a project-scoped transport adapter.
It validates a socket payload, uses the verified server-owned actor, authorizes
conversation access through the public SDK, performs the SDK operation, waits for
commit, serializes an allowlisted result, emits a notification, and acknowledges
the caller. It imports neither Drizzle nor repository or transaction interfaces.

The database is the source of truth. Socket delivery never represents
persistence, failed writes are never broadcast, and `clientMessageId` remains the
durable idempotency key. SDK post-commit subscriptions allow mutations originating
outside the socket handler to produce realtime notifications. Event IDs and
resource suppression prevent the adapter's direct detailed broadcast from being
repeated by that subscription. A full outbox is intentionally deferred.

Rooms are private implementation details generated from the immutable SDK
`projectId`. Actor rooms are populated only from verified identities.
Conversation joins accept only `conversationId` and call `messages.list` with the
verified actor before joining. Agents with `internal_note.read` additionally join
a separate agent-only conversation room. Internal notes never enter the public
conversation room.

Customer/visitor serializers allow only public message and conversation fields.
Agent serializers remain allowlists and omit project IDs, permissions, audit data,
and provider metadata. Assignment and tag detail is emitted only to authorized
agent rooms; customers receive only a generic conversation update where needed.
