import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@shipstamp/convex";

export async function POST(request: Request) {
  void request;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "missing_convex_url" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);
  const started = await client.mutation(api.deviceAuth.start, {});

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const verificationUri = base ? `${base}/device` : "/device";

  return NextResponse.json({
    deviceCode: started.deviceCode,
    userCode: started.userCode,
    verificationUri,
    intervalMs: started.intervalMs,
    expiresAtMs: started.expiresAtMs
  });
}
