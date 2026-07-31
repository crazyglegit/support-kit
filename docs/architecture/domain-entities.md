# Domain entities

`@crazyglegit/support-core` owns the framework-independent business model. Domain
entities use `Date` and contain no transport, ORM, framework, or provider types.

All support-owned entities are project-scoped. `ProjectScopedEntity` supplies an
opaque `id`, a server-derived `projectId`, and creation/update timestamps. The
initial model includes customers, anonymous visitors, agents, conversations,
participants, assignments, messages, attachment metadata, tags, saved replies,
message receipts, and audit events. A message receipt is scoped by project,
message, conversation, reader type, and reader ID; it records `readAt` without
changing the message's independent delivery status.

Customer and agent entities reference the host's identities through
`externalCustomerId` and `externalAgentId`; they do not reproduce the host user
record. Visitors retain a stable internal UUID and verified
`externalVisitorId`; they are never implicitly merged into customers.
Attachments contain safe metadata only and do not contain provider keys
or public URLs. Audit events are immutable records at the application boundary.

Transport representations belong in `@crazyglegit/support-contracts`. Database
records and mappings belong in a database adapter.
