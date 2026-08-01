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
