# Agent dashboard integration

```tsx
import { SupportDashboard } from "@crazyglegit/support-react";
export default function SupportPage() {
  return (
    <SupportDashboard
      apiBaseUrl="/api/support"
      socketUrl={process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL}
    />
  );
}
```

Protect the route using the host application's real server session. The component never accepts an agent ID, project ID, role, permissions, token, or secret. Same-origin credentials are used by default. The host authentication adapter returns a verified agent identity with an explicit role and exact permissions.

Supported operations are inbox/detail/history, replies, notes, assign-to-self, lifecycle changes, spam, tag mutation by existing ID, reads, typing, and realtime resynchronization. Agent directory, tag directory, saved replies, server search, attachments, AI, chatbot, and knowledge management are intentionally not simulated when their public SDK queries do not exist.

Package defaults are overridden only by validated local presentation settings. Server identity and permissions always win. React cleanup is automatic and Strict-Mode safe. Run `pnpm --filter @crazyglegit/support-dashboard size` for the emitted module report.
