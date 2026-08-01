# @crazyglegit/support-widget

Framework-independent, prebuilt customer support widget. The interface is rendered in a Shadow DOM and communicates only with the public Support Kit HTTP and Socket.IO APIs.

```ts
import { createSupportWidget } from "@crazyglegit/support-widget";

const widget = createSupportWidget({
  apiBaseUrl: "/api/support",
  socketUrl: window.location.origin,
});

widget.on("message.received", () => updateHostUnreadIndicator());
// widget.destroy() removes its DOM, socket, listeners, timers, and requests.
```

See [customer-widget.md](../../docs/integration/customer-widget.md) for configuration, authentication, theming, and troubleshooting.
