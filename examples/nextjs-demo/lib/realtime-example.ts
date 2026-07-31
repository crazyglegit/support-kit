import { createServer } from "node:http";
import {
  createSupportKit,
  type SupportAuthAdapter,
} from "@crazyglegit/support";
import { createDrizzleSupportDatabase } from "@crazyglegit/support-db-drizzle";
import { createSupportSocketServer } from "@crazyglegit/support-realtime-socketio";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

const demoOrigin = "https://example.com";

/** Focused Node lifecycle example; production hosts must verify real credentials. */
export async function runRealtimeExample(
  databaseUrl: string,
  conversationId: string,
) {
  const auth: SupportAuthAdapter = {
    getCustomer: (context) => {
      const data = context.data;
      if (
        typeof data !== "object" ||
        data === null ||
        !("auth" in data) ||
        typeof data.auth !== "object" ||
        data.auth === null ||
        !("demoToken" in data.auth) ||
        data.auth.demoToken !== "verified-by-host"
      )
        return Promise.resolve(null);
      return Promise.resolve({ id: "demo-customer" });
    },
    getVisitor: () => Promise.resolve(null),
    getAgent: () => Promise.resolve(null),
  };
  const support = await createSupportKit({
    projectKey: "main-app",
    projectInitialization: { mode: "require-existing" },
    database: createDrizzleSupportDatabase({ connectionString: databaseUrl }),
    auth,
    security: { allowedOrigins: [demoOrigin] },
    lifecycle: { adapterOwnership: "sdk" },
  });
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: [demoOrigin], credentials: true },
    maxHttpBufferSize: 64 * 1024,
    transports: ["websocket"],
  });
  const realtime = createSupportSocketServer({
    io,
    support,
    options: { allowedOrigins: [demoOrigin], maxPayloadBytes: 64 * 1024 },
  });
  await new Promise<void>((resolve) => httpServer.listen(3001, resolve));
  const client = createClient("http://localhost:3001", {
    transports: ["websocket"],
    extraHeaders: { Origin: demoOrigin },
    auth: {
      actorType: "customer",
      demoToken: "verified-by-host",
    },
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
  client.emit("conversation.join", { conversationId }, () => {
    client.emit("message.send", {
      conversationId,
      body: "Hello from the Socket.IO example.",
      clientMessageId: globalThis.crypto.randomUUID(),
    });
  });
  return async () => {
    client.disconnect();
    await realtime.dispose();
    await io.close();
    await support.dispose();
  };
}
