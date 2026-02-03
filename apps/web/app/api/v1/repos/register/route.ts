import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@shipstamp/convex";

export const runtime = "nodejs";

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

const RegisterRepoSchema = z.object({
  originUrl: z.string().min(1),
  normalizedOriginUrl: z.string().min(1),
  defaultBranch: z.string().min(1).optional()
});

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return NextResponse.json({ error: "missing_convex_url" }, { status: 500 });
  const client = new ConvexHttpClient(convexUrl);

  const auth = await client.query(api.apiTokens.verify, { token });
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RegisterRepoSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { repoId } = await client.mutation(api.repos.registerFromToken, { token, ...parsed.data });
  return NextResponse.json({ repoId });
}
