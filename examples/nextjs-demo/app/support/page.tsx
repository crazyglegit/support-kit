import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DemoSupportDashboard } from "./dashboard";

export default async function SupportPage() {
  const secret = process.env.SUPPORT_DEMO_AGENT_SECRET;
  const session = (await cookies()).get("support_demo_agent")?.value;
  if (!secret || session !== secret) redirect("/");
  return <DemoSupportDashboard />;
}
