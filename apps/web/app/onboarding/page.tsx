import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./OnboardingClient";

export default async function OnboardingPage() {
  const ok = await isAuthenticated();
  if (!ok) redirect("/sign-in");
  return <OnboardingClient />;
}
