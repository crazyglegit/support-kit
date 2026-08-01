"use client";

import { SupportWidget } from "@crazyglegit/support-react";

/** One-line public-package integration used by authenticated and visitor sessions. */
export function DemoSupportWidget() {
  return (
    <SupportWidget
      apiBaseUrl="/api/support"
      {...(process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL
        ? { socketUrl: process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL }
        : {})}
      title="Demo support"
      greeting="How can the Support Kit team help?"
    />
  );
}
