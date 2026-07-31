# SDK initialization

`createSupportKit(config)` validates configuration, resolves `projectKey` through `database.projects.findByKey`, stores the resulting immutable `projectId` inside that SDK instance, and constructs all application use cases privately.

By default, a missing project raises `NOT_FOUND`. Creation must be explicit:

```ts
projectInitialization: {
  mode: "create-if-missing",
  name: "Main application",
  metadata: { region: "in" },
}
```

Concurrent explicit initialization reuses a project created by another initializer. No global project cache exists.

Host adapters resolve verified identities through `support.auth`. Customers, agents, and visitors are validated and upserted into project-scoped internal UUID records. Visitor resolution is idempotent and never merges a visitor into a customer.

Operations are grouped under `conversations`, `messages`, `customers`, `agents`, and `tags`. Their inputs omit `projectId`; the SDK injects its resolved UUID.

Call `healthCheck()` for structured initialization, project, database, auth, and optional-adapter status. Adapters are probed only when they expose `healthCheck`. Missing optional adapters report `disabled`; configured adapters without a probe report `unavailable` and make overall health degraded.

`dispose()` is idempotent. With host ownership it only closes the SDK. With `adapterOwnership: "sdk"`, it also invokes available adapter disposal hooks once. New operations after disposal fail with `SDK_DISPOSED`.
