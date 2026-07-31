# PostgreSQL persistence

`@crazyglegit/support-db-drizzle` implements the framework-independent database ports with PostgreSQL and Drizzle ORM. It contains no HTTP, Next.js, realtime, UI, provider, or CLI behavior.

## Project identity

`support_projects.id` is the immutable UUID used by every domain object, repository operation, transaction, join, and foreign key. `support_projects.project_key` is a unique human-readable installation identifier used only by the project lookup and administration repository. An application boundary resolves `projectKey` to `projectId` once; tenant operations never accept a key.

## Tables

- `support_projects`: installation identity and controlled configuration metadata.
- `support_customers`, `support_visitors`, and `support_agents`: project-scoped references to verified host identities.
- `support_customer_sessions`: hashed customer or anonymous-session references; it is not an authentication system.
- `support_conversations` and `support_conversation_participants`: lifecycle state and ownership/membership.
- `support_conversation_assignments`: append-only assignment history. The adapter permits only the one-way addition of `unassigned_at` to an existing record.
- `support_messages`: durable content and transport delivery status.
- `support_message_receipts`: independent per-reader read state.
- `support_attachments`: provider-neutral attachment metadata.
- `support_tags` and `support_conversation_tags`: project-scoped labels and associations.
- `support_saved_replies`: reusable agent-authored content.
- `support_audit_logs`: append-only audit records.

## Isolation and constraints

Tenant repository methods require `projectId`, and every tenant lookup and join includes it. Cross-project record lookup returns `null`; malformed inputs and database constraint failures are mapped to sanitized `DomainError` values. Composite foreign keys bind associations to both the owning project and record ID, preventing a row from referencing another project's conversation, message, tag, or agent.

Unique constraints cover project keys, host identities per project, participants, active assignments, client message IDs per project/conversation, read receipts per project/message/reader, tag names, and conversation-tag pairs. PostgreSQL enums constrain conversation status, message type, sender type, participant/reader type, and delivery status. Project-first indexes support inbox, participant, message cursor, receipt, attachment, assignment, saved-reply, and audit queries.

## Transactions and events

`SupportDatabaseAdapter.transaction()` creates a Drizzle transaction and supplies repositories bound to that transaction. Application workflows write conversations, participants, messages, assignments, status changes, notes, receipts, tags, and audit records atomically. Application events are intentionally published after the transaction returns. A future transactional outbox can be added beside `support_audit_logs` without changing current application event results.

The adapter never runs migrations when imported.
