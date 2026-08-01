# @crazyglegit/support-react

Client-only React lifecycle wrappers for the widget and agent dashboard. React is a peer dependency and transport/state logic is not duplicated.

```tsx
import { SupportWidget } from "@crazyglegit/support-react";

export function AppSupport() {
  return (
    <SupportWidget apiBaseUrl="/api/support" socketUrl={location.origin} />
  );
}
```

The component is safe to import in a Next.js Server Component tree; browser access begins only after client mount.

```tsx
import { SupportDashboard } from "@crazyglegit/support-react";

export default function SupportPage() {
  return <SupportDashboard apiBaseUrl="/api/support" />;
}
```

Both wrappers defer creation through a cancellable microtask for React Strict Mode and dispose their controller on unmount.
