"use client";

import { SupportDashboard } from "@crazyglegit/support-react";

export function DemoSupportDashboard() {
  const socketUrl = process.env.NEXT_PUBLIC_SUPPORT_SOCKET_URL;
  return (
    <SupportDashboard
      apiBaseUrl="/api/support"
      {...(socketUrl ? { socketUrl } : {})}
    />
  );
}
