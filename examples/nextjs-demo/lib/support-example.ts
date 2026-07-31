import postgres from "postgres";
import {
  createSupportKit,
  defineSupportConfig,
  type SupportAuthAdapter,
} from "@crazyglegit/support";
import { createDrizzleSupportDatabase } from "@crazyglegit/support-db-drizzle";

const auth: SupportAuthAdapter = {
  getCustomer: () => Promise.resolve(null),
  getVisitor: () => Promise.resolve(null),
  getAgent: () => Promise.resolve(null),
};

/** Minimal server-side composition example; it does not create routes or UI. */
export async function inspectSupportHealth(databaseUrl: string) {
  const client = postgres(databaseUrl);
  const database = createDrizzleSupportDatabase({ client });
  const config = defineSupportConfig({
    projectKey: "main-app",
    projectInitialization: { mode: "require-existing" },
    database,
    auth,
    security: { allowedOrigins: ["https://example.com"] },
    lifecycle: { adapterOwnership: "host" },
  });
  const support = await createSupportKit(config);
  try {
    return await support.healthCheck();
  } finally {
    await support.dispose();
    await client.end();
  }
}
