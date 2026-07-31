# Phase 5 integration checkpoint

Run the complete PostgreSQL integration suite with:

```bash
pnpm build
pnpm test:integration
```

The suite starts PostgreSQL 16 through Testcontainers by default. When a
container runtime is unavailable, provide an empty disposable database:

```bash
SUPPORT_TEST_DATABASE_URL=postgresql://localhost/support_kit_test \
  pnpm test:integration
```

The configured database is test-only. The suite applies the checked-in
migrations and may leave support test records behind.

The public SDK checkpoint creates two isolated projects and exercises identity
resolution, conversations, inbox and assignment, public replies, internal-note
filtering, receipts, tags, lifecycle transitions, idempotency, authorization,
project isolation, and disposal through `@crazyglegit/support`. Direct database
access is limited to creating a tag because tag-definition administration is not
part of the Phase 5 public SDK.
