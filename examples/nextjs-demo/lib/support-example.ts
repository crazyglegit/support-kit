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

/** Creates the demo's server-side Support Kit configuration. */
export function createDemoSupportConfig(databaseUrl: string) {
  const database = createDrizzleSupportDatabase({
    connectionString: databaseUrl,
  });
  return defineSupportConfig({
    projectKey: "main-app",
    projectInitialization: { mode: "require-existing" },
    database,
    auth,
    security: { allowedOrigins: ["https://example.com"] },
    lifecycle: { adapterOwnership: "sdk" },
  });
}

/** Minimal server-side composition health example. */
export async function inspectSupportHealth(databaseUrl: string) {
  const config = createDemoSupportConfig(databaseUrl);
  const support = await createSupportKit(config);
  try {
    return await support.healthCheck();
  } finally {
    await support.dispose();
  }
}
