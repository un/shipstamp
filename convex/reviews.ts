import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

const FindingInput = v.object({
  path: v.string(),
  severity: v.string(),
  title: v.string(),
  message: v.string(),
  suggestion: v.optional(v.string()),
  line: v.optional(v.number()),
  agreementAgreed: v.optional(v.number()),
  agreementTotal: v.optional(v.number())
});

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyApiToken(
  ctx: MutationCtx,
  token: string
): Promise<{ userId: string; orgId: Id<"orgs"> } | null> {
  const tokenHash = await sha256Hex(token);
  const rec = await ctx.db
    .query("apiTokens")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();

  if (!rec) return null;
  if (rec.revokedAtMs) return null;
  if (!rec.orgId) return null;
  return { userId: rec.userId, orgId: rec.orgId };
}

export const recordRun = mutation({
  args: {
    token: v.string(),
    branch: v.string(),
    status: v.string(),
    planTier: v.string(),
    modelSet: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    originUrl: v.optional(v.string()),
    normalizedOriginUrl: v.optional(v.string()),
    findings: v.array(FindingInput)
  },
  handler: async (ctx, args): Promise<{ runId: Id<"reviewRuns"> }> => {
    const auth = await verifyApiToken(ctx, args.token);
    if (!auth) throw new Error("unauthorized");

    const normalizedOriginUrl = args.normalizedOriginUrl ?? "unknown";
    const originUrl = args.originUrl ?? "unknown";

    let repo: Doc<"repos"> | null = await ctx.db
      .query("repos")
      .withIndex("by_orgId_normalizedOriginUrl", (q) =>
        q.eq("orgId", auth.orgId).eq("normalizedOriginUrl", normalizedOriginUrl)
      )
      .unique();

    if (!repo) {
      const repoId = await ctx.db.insert("repos", {
        orgId: auth.orgId,
        originUrl,
        normalizedOriginUrl,
        defaultBranch: args.branch,
        createdAtMs: Date.now()
      });
      repo = await ctx.db.get(repoId);
    }

    if (!repo) throw new Error("failed_to_create_repo");

    const runId: Id<"reviewRuns"> = await ctx.db.insert("reviewRuns", {
      orgId: auth.orgId,
      repoId: repo._id,
      branch: args.branch,
      status: args.status,
      planTier: args.planTier,
      modelSet: args.modelSet,
      durationMs: args.durationMs,
      createdAtMs: Date.now()
    });

    for (const f of args.findings) {
      await ctx.db.insert("findings", {
        reviewRunId: runId,
        path: f.path,
        severity: f.severity,
        title: f.title,
        message: f.message,
        suggestion: f.suggestion,
        line: f.line,
        agreementAgreed: f.agreementAgreed,
        agreementTotal: f.agreementTotal
      });
    }

    return { runId };
  }
});
