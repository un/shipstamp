import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../../../convex/_generated/api";
import { reviewWorkflow } from "@/workflows/reviewWorkflow";

export const runtime = "nodejs";

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

const ReviewRequestSchema = z.object({
  originUrl: z.string().min(1).optional(),
  normalizedOriginUrl: z.string().min(1).optional(),
  branch: z.string().min(1),
  planTier: z.enum(["free", "paid"]),
  stagedPatch: z.string(),
  stagedFiles: z.array(
    z.object({
      path: z.string().min(1),
      changeType: z.string().min(1),
      isBinary: z.boolean()
    })
  ),
  instructionFiles: z.array(
    z.object({
      path: z.string().min(1),
      sha256: z.string().min(16)
    })
  )
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

  const parsed = ReviewRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.originUrl || !parsed.data.normalizedOriginUrl) {
    return NextResponse.json({
      status: "FAIL",
      findings: [
        {
          path: "package.json",
          severity: "minor",
          title: "Missing repo identity",
          message: "Shipstamp requires a git remote named 'origin' to identify the repository (remote.origin.url)."
        }
      ]
    });
  }

  // Until billing is implemented, default to free tier unless explicitly enabled.
  const planTier =
    parsed.data.planTier === "paid" && process.env.SHIPSTAMP_ENABLE_PAID_TIER === "1" ? "paid" : "free";

  // Enforce daily usage before invoking model workflows.
  try {
    const usage = await client.mutation(api.usage.consumeReviewRun, {
      token,
      planTier
    });

    if (!usage.allowed) {
      const limitLabel =
        usage.scope === "org"
          ? `org quota (${usage.org.count}/${usage.org.limit})`
          : `your quota (${usage.user.count}/${usage.user.limit})`;
      return NextResponse.json({
        status: "FAIL",
        findings: [
          {
            path: "package.json",
            severity: "minor",
            title: "Daily review limit reached",
            message: `You have reached your daily Shipstamp review limit for ${usage.day} (${limitLabel}).`
          }
        ]
      });
    }
  } catch {
    // If usage enforcement fails, treat as unchecked policy by returning a note and letting the CLI decide.
    return NextResponse.json({
      status: "UNCHECKED",
      findings: [
        {
          path: "package.json",
          severity: "note",
          title: "Usage tracking unavailable",
          message: "Shipstamp could not verify usage limits right now."
        }
      ]
    });
  }

  const t0 = Date.now();
  const result = await reviewWorkflow({ ...parsed.data, planTier });
  const durationMs = Date.now() - t0;

  // Best-effort persistence (don’t block response on Convex write failures).
  try {
    await client.mutation(api.reviews.recordRun, {
      token,
      originUrl: parsed.data.originUrl,
      normalizedOriginUrl: parsed.data.normalizedOriginUrl,
      branch: parsed.data.branch,
      status: result.status,
      planTier,
      modelSet: planTier === "paid" ? "openai+anthropic+google" : "openai",
      durationMs,
      perModel: result.modelRuns?.map((m) => ({
        model: m.model,
        findingsCount: m.findingsCount,
        latencyMs: m.latencyMs
      })),
      findings: result.findings.map((f) => ({
        path: f.path,
        severity: f.severity,
        title: f.title,
        message: f.message,
        suggestion: f.suggestion,
        line: f.line,
        agreementAgreed: f.agreement?.agreed,
        agreementTotal: f.agreement?.total
      }))
    });
  } catch {
    // ignore
  }

  return NextResponse.json(result);
}
