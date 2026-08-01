# @crazyglegit/support-dashboard

Framework-independent browser controller for the prebuilt Support Kit agent dashboard. It uses only public HTTP, Socket.IO, and browser-safe transport contracts.

```ts
import { createSupportDashboard } from "@crazyglegit/support-dashboard";
const controller = createSupportDashboard({
  target: document.querySelector("#support")!,
});
await controller.initialize();
```

Call `destroy()` on host teardown. Never pass identity, project, role, permission, token, or secret configuration; the verified server session supplies authority.

Attachment queues are isolated by conversation and by public-reply/internal-note mode. The dashboard uses only public HTTP routes for intents, completion, message association, and authorized downloads; Socket.IO carries sanitized message metadata only.
