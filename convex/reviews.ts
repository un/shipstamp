import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
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

type AuthzCtx = Pick<QueryCtx, "db" | "auth"> | Pick<MutationCtx, "db" | "auth">;

async function requireOrgMember(ctx: AuthzCtx, orgId: Id<"orgs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_userId", (q) => q.eq("orgId", orgId).eq("userId", identity.subject))
    .unique();

  if (!membership) throw new Error("Forbidden");
  return { userId: identity.subject, role: membership.role };
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
    perModel: v.optional(
      v.array(
        v.object({
          model: v.string(),
          findingsCount: v.number(),
          latencyMs: v.optional(v.number())
        })
      )
    ),
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

    // Best-effort per-model stats.
    if (args.perModel && args.perModel.length > 0) {
      const day = new Date(Date.now()).toISOString().slice(0, 10);
      for (const m of args.perModel) {
        const existing = await ctx.db
          .query("modelStats")
          .withIndex("by_orgId_day_model", (q) => q.eq("orgId", auth.orgId).eq("day", day).eq("model", m.model))
          .unique();

        if (!existing) {
          await ctx.db.insert("modelStats", {
            orgId: auth.orgId,
            model: m.model,
            day,
            runs: 1,
            findings: m.findingsCount,
            avgLatencyMs: m.latencyMs
          });
          continue;
        }

        const nextRuns = existing.runs + 1;
        const nextFindings = existing.findings + m.findingsCount;

        let nextAvg: number | undefined = existing.avgLatencyMs ?? undefined;
        if (typeof m.latencyMs === "number") {
          if (typeof existing.avgLatencyMs === "number") {
            nextAvg = Math.round((existing.avgLatencyMs * existing.runs + m.latencyMs) / nextRuns);
          } else {
            nextAvg = m.latencyMs;
          }
        }

        await ctx.db.patch(existing._id, {
          runs: nextRuns,
          findings: nextFindings,
          avgLatencyMs: nextAvg
        });
      }
    }

    return { runId };
  }
});

export const listRecentForOrg = query({
  args: {
    orgId: v.id("orgs"),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await requireOrgMember(ctx, args.orgId);

    const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
    const runs = await ctx.db
      .query("reviewRuns")
      .withIndex("by_orgId_createdAtMs", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(limit);

    const out: Array<{
      run: Doc<"reviewRuns">;
      repo: Doc<"repos"> | null;
      counts: { note: number; minor: number; major: number; total: number };
    }> = [];

    for (const run of runs) {
      const repo = await ctx.db.get(run.repoId);
      const findings = await ctx.db
        .query("findings")
        .withIndex("by_reviewRunId", (q) => q.eq("reviewRunId", run._id))
        .collect();

      const counts = { note: 0, minor: 0, major: 0, total: findings.length };
      for (const f of findings) {
        if (f.severity === "major") counts.major++;
        else if (f.severity === "minor") counts.minor++;
        else counts.note++;
      }

      out.push({ run, repo, counts });
    }

    return out;
  }
});

export const getRun = query({
  args: {
    runId: v.id("reviewRuns")
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;

    await requireOrgMember(ctx, run.orgId);

    const repo = await ctx.db.get(run.repoId);
    const findings = await ctx.db
      .query("findings")
      .withIndex("by_reviewRunId", (q) => q.eq("reviewRunId", run._id))
      .collect();

    return { run, repo, findings };
  }
});
