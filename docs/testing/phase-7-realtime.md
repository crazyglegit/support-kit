# Phase 7 realtime testing

The package test starts a real Socket.IO server and `socket.io-client` connections
on ephemeral localhost ports. It covers customer, visitor, and agent
authentication; origin and authentication failures/timeouts; room authorization;
strict and oversized payloads; message persistence ordering and idempotency;
read-receipt idempotency and multiple readers; failed persistence; internal-note
isolation; agent permissions and mutations; typing expiry; rate limiting; health;
and repeated disposal.

Run the focused suite with:

```bash
pnpm --filter @crazyglegit/support-realtime-socketio test
```

Some restricted sandboxes require permission for Vitest to bind an ephemeral
loopback port. The suite makes no external network request.
