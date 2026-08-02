# Knowledge chatbot security

- Project and actor scope come exclusively from verified server configuration and authentication.
- Knowledge management requires `knowledge.read` or `knowledge.manage`; hidden controls are not an authorization boundary.
- Retrieval selects only published articles and their active revisions in the same project.
- Internal notes, conversation messages, customer metadata, and agent-only records are not knowledge sources.
- The provider receives bounded plain text and cannot call tools or application services.
- Retrieved content and user messages are untrusted data, not instructions.
- Provider responses pass strict runtime validation. Citation keys are checked against the retrieved allowlist before persistence or display.
- Browser responses omit project IDs, actor IDs, agent IDs, model references, and provider errors.
- Messages render as escaped plain text inside the widget Shadow DOM. Citations contain allowlisted display fields only.
- AI failure produces sanitized fallback copy and does not prevent direct human support.

Do not put provider credentials in widget or dashboard options. Do not build knowledge from internal notes. Review published content as potentially adversarial input and archive compromised articles immediately.
