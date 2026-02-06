import { NextResponse } from "next/server";
import { fetchAuthMutation, fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@gitpreflight/convex";
import { getResendClient, getResendFromEmail } from "@/lib/resend";
import { WelcomeEmail } from "@/emails/WelcomeEmail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  void request;
  const ok = await isAuthenticated();
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const already = await fetchAuthQuery(api.emailEvents.hasSent, { type: "welcome" });
  if (already) return NextResponse.json({ ok: true, skipped: true });

  const identity = await fetchAuthQuery(api.auth.getCurrentUser, {} as any);
  const email = identity?.email;
  if (!email) return NextResponse.json({ ok: true, skipped: true });

  const resend = getResendClient();
  const from = getResendFromEmail();
  if (!resend || !from) {
    return NextResponse.json({ ok: true, emailed: false });
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Welcome to GitPreflight",
    react: WelcomeEmail({ name: identity?.name })
  });

  await fetchAuthMutation(api.emailEvents.markSent, { type: "welcome" });
  return NextResponse.json({ ok: true, emailed: true });
}
