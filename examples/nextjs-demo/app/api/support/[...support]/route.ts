import { createSupportHandler } from "@crazyglegit/support-nextjs";
import { createDemoSupportConfig } from "../../../../lib/support-example";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/support";

export const { GET, POST, PATCH, DELETE } = createSupportHandler(
  createDemoSupportConfig(databaseUrl),
);
