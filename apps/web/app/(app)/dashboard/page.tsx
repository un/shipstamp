import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@shipstamp/convex";

export default async function DashboardPage() {
  const ok = await isAuthenticated();
  if (!ok) redirect("/sign-in");

  const orgs = await fetchAuthQuery(api.orgs.listMine, {} as any);
  if (!orgs || orgs.length === 0) {
    redirect("/onboarding");
  }

  return <DashboardClient />;
}
