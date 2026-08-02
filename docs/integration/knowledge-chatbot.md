# Knowledge base and chatbot integration

Enable the feature in server configuration only:

```ts
defineSupportConfig({
  // existing project, auth, database, and security configuration
  features: { chatbot: true },
  chatbot: {
    enabled: true,
    retrieval: { mode: "lexical" },
  },
  ai: createChatbotAIAdapter(provider),
});
```

The AI provider implements a narrow adapter. It receives the current question, a bounded transcript, published retrieved chunks, an allowed citation-key list, and output limits. It receives no repositories, database client, secrets from browser input, arbitrary tool interface, or unrestricted application access.

## Public HTTP routes

Customer/visitor routes:

- `POST /api/support/chatbot/sessions`
- `GET /api/support/chatbot/sessions/:sessionId`
- `GET|POST /api/support/chatbot/sessions/:sessionId/messages`
- `POST /api/support/chatbot/sessions/:sessionId/handoff`

Agent knowledge routes:

- `GET|POST /api/support/agent/knowledge`
- `PATCH /api/support/agent/knowledge/:articleId`
- `POST /api/support/agent/knowledge/:articleId/publish`
- `POST /api/support/agent/knowledge/:articleId/archive`
- `POST /api/support/agent/knowledge/:articleId/restore`
- `GET /api/support/agent/knowledge/:articleId/revisions`

The routes never accept a project ID, actor ID, role, permission, or provider secret. The Next.js adapter resolves the actor using the configured server auth adapter, while the SDK injects the already-resolved project ID.

When disabled, the existing human-support widget remains unchanged. When enabled, the Shadow DOM widget shows “Ask the support assistant,” citations, uncertainty states, and an explicit “Talk to a human” action. Human conversations remain available if AI or realtime is unavailable.

The prebuilt agent dashboard exposes a Knowledge workspace when server-resolved permissions include `knowledge.read`. Draft creation and lifecycle controls require `knowledge.manage`; the server repeats every permission check regardless of control visibility.

Apply migration `0003_knowledge_chatbot.sql`. It adds project-scoped article, revision, chunk, session, turn, and handoff tables plus the lexical search index.
