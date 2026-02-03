import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@shipstamp/convex";

export const runtime = "nodejs";

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return NextResponse.json({ error: "missing_convex_url" }, { status: 500 });
  const client = new ConvexHttpClient(convexUrl);

  const auth = await client.query(api.apiTokens.verify, { token });
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const settings = await client.query(api.settings.getForToken, { token } as any);
  return NextResponse.json({
    instructionFilenames: settings.instructionFilenames,
    promptAppend: settings.promptAppend
  });
}
