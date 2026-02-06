import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@gitpreflight/convex";

export const runtime = "nodejs";

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const files = Array.isArray(body?.files) ? body.files : null;
  if (!files) return NextResponse.json({ error: "missing_files" }, { status: 400 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return NextResponse.json({ error: "missing_convex_url" }, { status: 500 });

  const client = new ConvexHttpClient(convexUrl);
  try {
    const result = await client.mutation(api.instructions.checkMissing, { token, files });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
