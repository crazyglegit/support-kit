# Next.js HTTP adapter

`@crazyglegit/support-nextjs` exposes Web-standard handlers that mount Support Kit in a
Next.js App Router catch-all route.

```ts
// app/api/support/[...support]/route.ts
import { createSupportHandler } from "@crazyglegit/support-nextjs";
import { supportConfig } from "@/support.config";

export const { GET, POST, PATCH, DELETE } = createSupportHandler(supportConfig);
```

The handler initializes one Support Kit instance lazily, converts request headers into
the provider-neutral authentication context, validates JSON bodies, and returns the
shared `{ success, data }` or `{ success, error }` envelopes. Mutation requests with an
`Origin` header are accepted only when that exact origin occurs in
`security.allowedOrigins`.

## Implemented routes

- Customer: session, conversation list/create/detail, message list/create, and read receipt.
- Agent: inbox/detail, reply, internal note, assignment, resolve, reopen, and status update.

Customer endpoints try the configured customer identity first and then the verified
visitor identity. Agent endpoints require an agent identity. Conversation ownership and
agent permissions are enforced again in the framework-independent application layer.

Future upload, AI, saved-reply, customer-detail, and admin endpoints return a structured
404 until their corresponding public SDK operations exist; the HTTP adapter does not
reach through the SDK into repositories.
