# Agent dashboard security

Agent identity, project scope, role, and permissions originate only from the verified public server authentication boundary. UI permission checks improve usability but never authorize an operation; the SDK checks every read and mutation again. Exact Origin protection remains active for HTTP mutations and Socket.IO uses the configured exact origin boundary.

Agent HTTP serializers allowlist conversation and message fields and omit project IDs, sender IDs, repository metadata, and raw errors. Message and note bodies are rendered with `textContent`; metadata is not rendered as HTML. No credentials, tokens, permissions, messages, or customer data are written to localStorage.

Internal notes use agent-only routes and rooms. The controller requires `internal_note.read` before accepting or rendering note history/events, and `internal_note.create` before exposing note mode. Customer and widget serializers remain note-free.

Localization overrides are bounded plain strings and reject markup characters before static interface templates are rendered. Conversation content always uses `textContent`; arbitrary metadata is not accepted or rendered. Authentication failures clear private browser state immediately.
