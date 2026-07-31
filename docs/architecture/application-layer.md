# Application layer

`@crazyglegit/support-application` orchestrates support workflows without knowing
about HTTP, frameworks, databases, realtime transports, or providers. Each use
case is a dependency-injected class with one `execute(input)` method. Every input
contains an explicit `projectId`; project scope is repeated on every repository
operation rather than inferred from client data.

## Use-case catalog

| Area                 | Use cases                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Conversations        | `CreateConversation`, `ChangeConversationStatus`, `ReopenConversation`, `MarkConversationAsSpam` |
| Messages             | `SendMessage`, `AddInternalNote`, `RecordMessageRead`, `ListConversationMessages`                |
| Assignment and inbox | `AssignConversation`, `ListAgentInbox`                                                           |
| Customer access      | `ListCustomerConversations`, `UpsertCustomer`                                                    |
| Agents               | `UpsertAgent`                                                                                    |
| Tags                 | `AddConversationTag`, `RemoveConversationTag`                                                    |

Client message IDs are checked before writes. A retry returns the existing
message without adding an audit record or emitting another event. Read receipts
use the same pattern: one receipt per project, message, reader type, and reader
ID. Message delivery status remains independent.

## Dependency ports

`ApplicationDependencies` contains only:

- `database`: the project-scoped repositories and transaction boundary from
  `@crazyglegit/support-core`.
- `clock`: deterministic current time.
- `ids`: opaque identifier generation.
- optional `events`: a framework-independent application event publisher.

Adapters implement these interfaces later. No provider object or framework
request enters the application layer.

## Transaction boundaries

Multi-record workflows run inside `SupportDatabaseAdapter.transaction`. The
conversation, initial message and participant are one unit. Messages, internal
notes, assignments and lifecycle changes include their audit record in the same
unit. Assignment changes close the active assignment before creating its
replacement.

Events are collected during the transaction and published only after commit.
An event publisher failure is sanitized but cannot roll back an already
committed database transaction. Guaranteed database-to-broker delivery requires
a transactional outbox and is deferred to the database/realtime phases.

## Authorization responsibilities

The application layer enforces ownership and exact permissions. Customers and
visitors must be conversation participants. Agents receive explicit permissions
from the trusted caller; no role inference or wildcard matching occurs.
Internal notes require `internal_note.create` and are filtered unless an agent
has `internal_note.read`. Customer channels always exclude internal notes.

Project scope is part of every lookup. A record in another project behaves as
not found and cannot be accessed by changing an input project ID.

## Event model

Application events are plain typed objects with an ID, event type, project ID,
optional conversation ID, occurrence time, and typed data. Current event names
cover conversation creation, assignment and status changes; message creation and
reads; internal notes; customer and agent updates; and tag changes.

These are application notifications, not Socket.IO events. Transport adapters
may translate them later. No event is emitted for an idempotent retry.

## Error boundary

Known `DomainError` instances pass through unchanged. Unknown repository,
transaction, or publisher failures are mapped to `INTERNAL_ERROR` with a safe
message; raw implementation errors are never exposed.
