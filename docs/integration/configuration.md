# Configuration API

`defineSupportConfig` validates declarative configuration while preserving typed adapter objects. `projectKey` is the installation-facing identifier; callers never configure an internal UUID.

```ts
const config = defineSupportConfig({
  projectKey: "main-app",
  projectInitialization: { mode: "require-existing" },
  database,
  auth,
  security: {
    allowedOrigins: ["https://app.example.com"],
    maxUploadBytes: 5_000_000,
  },
  features: { attachments: false, aiWriting: false },
  lifecycle: { adapterOwnership: "host" },
});
```

Allowed origins must be exact URL origins. Uploads are limited to 100 MiB and enabling attachments requires both storage and an explicit upload limit. Enabling AI writing requires an AI adapter. Optional realtime, storage, notification, and AI adapters are never replaced by silent no-ops.

Agent identities require an explicit support role and explicit permissions. The SDK never infers one from the other.
