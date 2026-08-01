import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import { DemoSupportWidget } from "./support-widget";

export const metadata: Metadata = {
  description: "Minimal host application for the Support Kit monorepo",
  title: "Support Kit Demo",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <DemoSupportWidget />
      </body>
    </html>
  );
}
