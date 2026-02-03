import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const hasSent = query({
  args: {
    type: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const existing = await ctx.db
      .query("emailEvents")
      .withIndex("by_userId_type", (q) => q.eq("userId", identity.subject).eq("type", args.type))
      .unique();

    return !!existing;
  }
});

export const markSent = mutation({
  args: {
    type: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("emailEvents")
      .withIndex("by_userId_type", (q) => q.eq("userId", identity.subject).eq("type", args.type))
      .unique();

    if (existing) return { ok: true };

    await ctx.db.insert("emailEvents", {
      userId: identity.subject,
      type: args.type,
      createdAtMs: Date.now()
    });

    return { ok: true };
  }
});
