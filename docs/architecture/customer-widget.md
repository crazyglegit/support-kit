# Customer widget architecture

```text
controller bootstrap
  -> public widget config + verified HTTP session + conversation list
  -> isolated Shadow DOM render
  -> authenticated Socket.IO connection
  -> authorized active-conversation join
  -> realtime notification merge or HTTP resync
```

The widget package imports the browser-safe public `@crazyglegit/support-contracts/widget` subpath and browser transports only. That subpath depends on Zod and transport schemas, not the contracts root or core domain. The widget never imports the core, application layer, database adapter, repositories, transactions, SDK use cases, or server authentication internals. The React package owns only component lifecycle.

Bootstrap fetches public configuration, resolves the verified HTTP session, and only then requests private conversation data or creates a socket. Durable state is fetched and mutated over HTTP. Realtime is a versioned notification stream. A detailed valid public message can be merged immediately; an ID-only post-commit notification causes a history fetch. Message order is `createdAt` then durable ID, with durable ID and `clientMessageId` reconciliation. Internal notes are unrepresentable in the customer message schema and are rejected again before state insertion.

Shadow DOM was selected because the blueprint supports direct application rendering and defers an iframe runtime. There is no iframe document route or authentication-safe postMessage bootstrap. All widget CSS is inside the root, with safe validated variables on the host.

React schedules controller creation in a cancellable microtask. React Strict Mode's discarded development effect is cleaned up before that microtask, so it does not create a duplicate controller, request set, or socket.
