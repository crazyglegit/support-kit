# Knowledge and customer chatbot

Phase 12 adds an optional, project-scoped knowledge base and grounded customer assistant. The dependency direction remains `core → application → adapters → composed SDK → HTTP → browser UI`. Browser packages import only browser-safe contracts and call public HTTP routes; they never import repositories, database code, application use cases, or provider SDKs.

## Publication and retrieval

Articles move through `draft`, `published`, and `archived`. Publishing creates an immutable revision, chunks its plain-text body, and atomically selects that revision as active. Retrieval joins only published articles to their active revision. Draft, archived, old, and foreign-project chunks cannot enter chatbot context.

The guaranteed baseline is PostgreSQL full-text/lexical retrieval. Semantic and hybrid modes are provider-neutral extension points and require an embedding adapter. No provider-specific vector type is part of the public contract in this phase.

The application ranks a bounded number of chunks, limits total context, and sends only that context to the AI adapter. User text and retrieved text are explicitly treated as untrusted data. Provider output must be structured and validated; citation keys must match the retrieved allowlist. When retrieval is insufficient or generation fails, the assistant uses a deterministic uncertainty response and offers human handoff.

## Sessions and handoff

Chatbot sessions belong to one verified customer or visitor within one project. Ownership is checked on every read, send, and handoff. A handoff transaction creates a normal waiting conversation, its customer/visitor participant, a structured agent-only handoff record, and an audit event. Repeated handoff requests return the existing handoff.

Chatbot transcripts and summaries are not customer conversation messages. They become available to agents only through the handoff record; internal notes and agent-only data never enter retrieval or customer responses.
