# Configuration API

Consumers create configuration with `defineSupportConfig` from
`@crazyglegit/support`.

```ts
import { defineSupportConfig } from "@crazyglegit/support";

export default defineSupportConfig({
  projectId: "main-app",
  auth,
  database,
  realtime,
  widget: {
    theme: "system",
    allowAnonymousVisitors: true,
  },
  features: {
    attachments: true,
  },
  security: {
    allowedOrigins: ["https://app.example.com"],
    maxUploadBytes: 5_000_000,
  },
});
```

Zod validates only serializable configuration: `projectId`, widget settings,
feature flags, allowed origins, and upload limits. Adapter objects are preserved
by identity and checked by TypeScript against narrow provider-independent ports.

`allowedOrigins` is required and accepts exact URL origins only. Route adapters
must enforce it at their trust boundary. `maxUploadBytes` is optional and capped
at 100 MiB; later storage and API adapters must also enforce this value rather
than trusting client metadata.

Optional storage, notification, and AI adapters should be provided only when the
corresponding feature is enabled. Phase 2 defines these ports but supplies no
implementations.
