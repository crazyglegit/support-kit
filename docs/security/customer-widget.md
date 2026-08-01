# Customer widget security

The browser never supplies project, actor ID, role, permission, or secret configuration. Public configuration validation rejects unknown identity/security keys and endpoint URLs containing credentials or token-like query strings. HTTP and Socket.IO resolve the actor from the host boundary, derive project scope from the SDK instance, and authorize each conversation server-side. Cookies or host credentials are not copied to localStorage or event payloads.

Customer HTTP responses use explicit allowlist serializers that omit project IDs, sender IDs, metadata, and internal notes. Customer realtime already uses a public room and serializer; the widget additionally accepts only strict customer schemas and rejects `internal_note` or unknown envelope versions. Message bodies are inserted as escaped plain text. No arbitrary HTML, embedded media, `dangerouslySetInnerHTML`, CSS injection, raw server error, token, or provider detail is rendered.

Mutation origin checks remain exact. Socket origins and payload limits remain the host/realtime adapter's responsibility. Theme inputs accept bounded numeric values, safe hex colors, and a restricted font string.
