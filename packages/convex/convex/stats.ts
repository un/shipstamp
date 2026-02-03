import { query } from "./_generated/server";
import { v } from "convex/values";

export const listModelStatsForOrgDay = query({
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

    const stats = await ctx.db
      .query("modelStats")
      .withIndex("by_orgId_day_model", (q) => q.eq("orgId", args.orgId).eq("day", args.day))
      .collect();

    stats.sort((a, b) => a.model.localeCompare(b.model));
    return stats;
  }
});
