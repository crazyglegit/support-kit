# Database integration

Install and create the adapter with either a connection string or an existing `postgres` client:

```ts
import postgres from "postgres";
import { createDrizzleSupportDatabase } from "@crazyglegit/support-db-drizzle";

const client = postgres(process.env.DATABASE_URL!);
const database = createDrizzleSupportDatabase({ client });
```

At installation or administration time, resolve the configured project key once:

```ts
const project = await database.projects.findByKey("main-app");
if (!project) throw new Error("Support project is not installed");

const projectId = project.id;
```

Pass only `projectId` to application use cases and tenant repositories. Never store or pass `projectKey` as a tenant foreign key.

## Migrations

Generate and verify checked-in migrations:

```bash
pnpm --filter @crazyglegit/support-db-drizzle db:generate
pnpm --filter @crazyglegit/support-db-drizzle db:check
```

Run migrations explicitly from deployment or installation code:

```ts
import { runSupportMigrations } from "@crazyglegit/support-db-drizzle";

await runSupportMigrations({ connectionString: process.env.DATABASE_URL! });
```

The package does not migrate at import time. Existing published migrations must remain immutable; later schema changes receive new migration files.

## Integration tests

The suite uses Testcontainers and requires a Docker-compatible runtime:

```bash
pnpm --filter @crazyglegit/support-db-drizzle test:integration
```

If containers are unavailable, point the same suite at a disposable PostgreSQL database:

```bash
SUPPORT_TEST_DATABASE_URL=postgresql://localhost/support_kit_test \
  pnpm --filter @crazyglegit/support-db-drizzle test:integration
```

It migrates an empty PostgreSQL 16 database and verifies isolation, uniqueness, transactions, rollback, idempotency, receipts, assignment history, tags, attachments, enum validation, and sanitized failures.
