# Public Support SDK API

`@crazyglegit/support` exports the composition factory, configuration helper, SDK and operation types, provider-neutral adapter types, identity types, health types, project initialization/lifecycle types, and `SupportKitError` types.

It intentionally does not export repositories, transactions, Drizzle clients, application dependency containers, or use-case constructors.

```ts
const support = await createSupportKit(config);

const actor = await support.auth.resolveCustomer(authContext);
const conversations = await support.conversations.listForCustomer({ actor });
```

Public errors have a stable `code`, sanitized `message`, and optional safe details. Unknown dependency failures become `INTERNAL_ERROR`; disposed SDK instances return `SDK_DISPOSED`; absent optional features use `FEATURE_UNAVAILABLE` when an exposed optional feature operation requires them.
