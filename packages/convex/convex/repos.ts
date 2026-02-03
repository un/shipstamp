import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";

type AuthzCtx = Pick<QueryCtx, "db" | "auth"> | Pick<MutationCtx, "db" | "auth">;

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

export const registerFromToken = mutation({
  args: {
    token: v.string(),
    originUrl: v.string(),
    normalizedOriginUrl: v.string(),
    defaultBranch: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<{ repoId: Id<"repos"> }> => {
    const auth = await verifyApiToken(ctx, args.token);
    if (!auth) throw new Error("unauthorized");

    const existing = await ctx.db
      .query("repos")
      .withIndex("by_orgId_normalizedOriginUrl", (q) =>
        q.eq("orgId", auth.orgId).eq("normalizedOriginUrl", args.normalizedOriginUrl)
      )
      .unique();

    const now = Date.now();
    if (!existing) {
      const repoId = await ctx.db.insert("repos", {
        orgId: auth.orgId,
        originUrl: args.originUrl,
        normalizedOriginUrl: args.normalizedOriginUrl,
        defaultBranch: args.defaultBranch ?? "main",
        createdAtMs: now
      });
      return { repoId };
    }

    await ctx.db.patch(existing._id, {
      originUrl: args.originUrl,
      defaultBranch: args.defaultBranch ?? existing.defaultBranch
    });

    return { repoId: existing._id };
  }
});

export const listForOrg = query({
  args: {
    orgId: v.id("orgs")
  },
  handler: async (ctx, args): Promise<Array<Doc<"repos">>> => {
    await requireOrgMember(ctx, args.orgId);

    return await ctx.db
      .query("repos")
      .withIndex("by_orgId_createdAtMs", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
  }
});

export const get = query({
  args: {
    repoId: v.id("repos")
  },
  handler: async (ctx, args): Promise<Doc<"repos"> | null> => {
    const repo = await ctx.db.get(args.repoId);
    if (!repo) return null;
    await requireOrgMember(ctx, repo.orgId);
    return repo;
  }
});
