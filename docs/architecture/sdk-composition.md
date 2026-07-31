# SDK composition

The public `@crazyglegit/support` package is a composition root:

```text
validated host configuration
  -> projectKey lookup
  -> immutable projectId
  -> application dependencies
  -> private use-case instances
  -> grouped public operations
```

The package depends on contracts, application, and core ports, but never on Drizzle or a framework. Repositories, transactions, dependency containers, and use-case constructors are not reachable through the SDK object.

Unknown failures become sanitized `SupportKitError` instances. Domain errors retain stable codes without exposing provider errors or credentials. Optional integrations do not affect durable conversation workflows when absent.
