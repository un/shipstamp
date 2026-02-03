import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    const out: Array<{ org: any; role: string }> = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (!org) continue;
      out.push({ org, role: m.role });
    }

    return out;
  }
});

export const create = mutation({
  args: {
    name: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const slug = slugify(args.name);
    if (!slug) throw new Error("Invalid org name");

    const existing = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) throw new Error("Org slug already taken");

    const now = Date.now();
    const orgId = await ctx.db.insert("orgs", {
      name: args.name,
      slug,
      createdAtMs: now
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId: identity.subject,
      role: "owner",
      createdAtMs: now
    });

    return { orgId, slug };
  }
});
