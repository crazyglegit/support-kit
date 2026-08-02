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

When server attachment configuration is enabled, active conversations include a keyboard-accessible file picker, progress, cancellation, retry, removal, attachment-only sends, safe file cards, and authorized temporary downloads. No storage key or permanent URL enters widget state.

When the server advertises `features.chatbot`, the home screen offers a published-knowledge assistant with escaped plain-text answers, validated source citations, uncertainty messaging, and explicit human handoff. Browser configuration cannot enable it or supply project or actor identity. See [knowledge-chatbot.md](../../docs/integration/knowledge-chatbot.md).
