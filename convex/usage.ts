import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

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

function dayKeyUtc(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

const ORG_SENTINEL_USER_ID = "__org__";

const FREE_DAILY_USER_REVIEW_LIMIT = 50;
const FREE_DAILY_ORG_REVIEW_LIMIT = 200;

export const consumeReviewRun = mutation({
  args: {
    token: v.string(),
    planTier: v.string()
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        allowed: true;
        day: string;
        user: { count: number; limit: number | null };
        org: { count: number; limit: number | null };
      }
    | {
        allowed: false;
        day: string;
        scope: "user" | "org";
        user: { count: number; limit: number | null };
        org: { count: number; limit: number | null };
      }
  > => {
    const auth = await verifyApiToken(ctx, args.token);
    if (!auth) throw new Error("unauthorized");

    const planTier = args.planTier === "paid" ? "paid" : "free";
    const userLimit = planTier === "paid" ? null : FREE_DAILY_USER_REVIEW_LIMIT;
    const orgLimit = planTier === "paid" ? null : FREE_DAILY_ORG_REVIEW_LIMIT;
    const day = dayKeyUtc(Date.now());

    let userRec = await ctx.db
      .query("usageDaily")
      .withIndex("by_orgId_userId_day", (q) => q.eq("orgId", auth.orgId).eq("userId", auth.userId).eq("day", day))
      .unique();

    if (!userRec) {
      const id = await ctx.db.insert("usageDaily", {
        orgId: auth.orgId,
        userId: auth.userId,
        day,
        count: 0
      });
      userRec = await ctx.db.get(id);
    }

    let orgRec = await ctx.db
      .query("usageDaily")
      .withIndex("by_orgId_userId_day", (q) =>
        q.eq("orgId", auth.orgId).eq("userId", ORG_SENTINEL_USER_ID).eq("day", day)
      )
      .unique();

    if (!orgRec) {
      const id = await ctx.db.insert("usageDaily", {
        orgId: auth.orgId,
        userId: ORG_SENTINEL_USER_ID,
        day,
        count: 0
      });
      orgRec = await ctx.db.get(id);
    }

    if (!userRec || !orgRec) throw new Error("failed_to_create_usage");

    if (orgLimit != null && orgRec.count >= orgLimit) {
      return {
        allowed: false,
        day,
        scope: "org",
        user: { count: userRec.count, limit: userLimit },
        org: { count: orgRec.count, limit: orgLimit }
      };
    }

    if (userLimit != null && userRec.count >= userLimit) {
      return {
        allowed: false,
        day,
        scope: "user",
        user: { count: userRec.count, limit: userLimit },
        org: { count: orgRec.count, limit: orgLimit }
      };
    }

    await ctx.db.patch(userRec._id, { count: userRec.count + 1 });
    await ctx.db.patch(orgRec._id, { count: orgRec.count + 1 });

    return {
      allowed: true,
      day,
      user: { count: userRec.count + 1, limit: userLimit },
      org: { count: orgRec.count + 1, limit: orgLimit }
    };
  }
});

export const getMyDailyUsage = query({
  args: {
    orgId: v.id("orgs"),
    day: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId).eq("userId", identity.subject))
      .unique();
    if (!membership) throw new Error("Forbidden");

    const rec = await ctx.db
      .query("usageDaily")
      .withIndex("by_orgId_userId_day", (q) =>
        q.eq("orgId", args.orgId).eq("userId", identity.subject).eq("day", args.day)
      )
      .unique();

    const limit = FREE_DAILY_USER_REVIEW_LIMIT;
    const count = rec?.count ?? 0;
    return { day: args.day, count, limit, remaining: Math.max(0, limit - count) };
  }
});

export const getOrgDailyUsage = query({
  args: {
    orgId: v.id("orgs"),
    day: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId).eq("userId", identity.subject))
      .unique();
    if (!membership) throw new Error("Forbidden");

    const rec = await ctx.db
      .query("usageDaily")
      .withIndex("by_orgId_userId_day", (q) =>
        q.eq("orgId", args.orgId).eq("userId", ORG_SENTINEL_USER_ID).eq("day", args.day)
      )
      .unique();

    const limit = FREE_DAILY_ORG_REVIEW_LIMIT;
    const count = rec?.count ?? 0;
    return { day: args.day, count, limit, remaining: Math.max(0, limit - count) };
  }
});
