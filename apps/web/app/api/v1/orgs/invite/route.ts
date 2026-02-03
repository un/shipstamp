import { NextResponse } from "next/server";
import { fetchAuthMutation, fetchAuthQuery, isAuthenticated } from "@/lib/auth-server";
import { api } from "@shipstamp/convex";
import { getResendClient, getResendFromEmail } from "@/lib/resend";
import { InviteEmail } from "@/emails/InviteEmail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ok = await isAuthenticated();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  const email = typeof body?.email === "string" ? body.email : "";
  const role = typeof body?.role === "string" ? body.role : undefined;

  if (!orgId || !email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const created = await fetchAuthMutation(api.invites.create, {
    orgId,
    email,
    role
  } as any);

  const orgs = await fetchAuthQuery(api.orgs.listMine, {} as any);
  const org = orgs?.find((o: any) => o.org?._id === orgId)?.org;
  const orgName = org?.name ?? "your org";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const acceptUrl = `${siteUrl.replace(/\/$/, "")}/onboarding?code=${encodeURIComponent(created.code)}`;

  const resend = getResendClient();
  const from = getResendFromEmail();
  let emailed = false;

  if (resend && from) {
    await resend.emails.send({
      from,
      to: email,
      subject: `You're invited to join ${orgName} on Shipstamp`,
      react: InviteEmail({ orgName, inviteCode: created.code, acceptUrl })
    });
    emailed = true;
  }

  return NextResponse.json({
    inviteCode: created.code,
    expiresAtMs: created.expiresAtMs,
    emailed
  });
}
