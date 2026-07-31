import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { throwSanitizedDatabaseError } from "./database.js";

/** Options for explicitly running packaged support migrations. */
export interface RunSupportMigrationsOptions {
  readonly connectionString?: string;
  readonly client?: Sql;
  readonly migrationsFolder?: string;
}

/** Runs support migrations. Importing this package never runs migrations automatically. */
export async function runSupportMigrations(
  options: RunSupportMigrationsOptions,
): Promise<void> {
  const ownsClient = !options.client;
  const client =
    options.client ?? postgres(options.connectionString ?? "", { max: 1 });
  let failure: unknown;
  try {
    await migrate(drizzle(client), {
      migrationsFolder:
        options.migrationsFolder ??
        new URL("../drizzle", import.meta.url).pathname,
    });
  } catch (error) {
    failure = error;
  } finally {
    if (ownsClient) {
      try {
        await client.end();
      } catch (error) {
        failure ??= error;
      }
    }
  }
  if (failure) throwSanitizedDatabaseError(failure);
}
