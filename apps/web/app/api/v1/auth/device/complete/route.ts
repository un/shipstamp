import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@shipstamp/convex";

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "missing_convex_url" }, { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const deviceCode = typeof body?.deviceCode === "string" ? body.deviceCode : "";
  if (!deviceCode) {
    return NextResponse.json({ error: "missing_device_code" }, { status: 400 });
  }

  const client = new ConvexHttpClient(convexUrl);
  try {
    const result = await client.mutation(api.deviceAuth.complete, { deviceCode });
    return NextResponse.json({ token: result.token });
  } catch (err) {
    const msg = (err as Error).message ?? "unknown";
    if (msg.includes("authorization_pending")) {
      return NextResponse.json({ error: "authorization_pending" }, { status: 428 });
    }
    if (msg.includes("expired")) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }
    if (msg.includes("already_consumed")) {
      return NextResponse.json({ error: "already_consumed" }, { status: 409 });
    }
    return NextResponse.json({ error: "exchange_failed" }, { status: 400 });
  }
}
