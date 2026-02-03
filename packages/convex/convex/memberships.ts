import { query } from "./_generated/server";
import { v } from "convex/values";

const ROLE_RANK: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2
};

export const listForOrg = query({
  args: {
    orgId: v.id("orgs")
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId).eq("userId", identity.subject))
      .unique();
    if (!membership) throw new Error("Forbidden");

    const members = await ctx.db
      .query("memberships")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    members.sort((a, b) => {
      const ar = ROLE_RANK[a.role] ?? 99;
      const br = ROLE_RANK[b.role] ?? 99;
      if (ar !== br) return ar - br;
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
      return a.userId.localeCompare(b.userId);
    });

    return members.map((m) => ({ userId: m.userId, role: m.role, createdAtMs: m.createdAtMs }));
  }
});
