import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const InstructionRef = v.object({
  path: v.string(),
  sha256: v.string()
});

export const checkMissing = mutation({
  args: {
    token: v.string(),
    files: v.array(InstructionRef)
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(api.apiTokens.verify, { token: args.token });
    if (!auth || !auth.orgId) throw new Error("unauthorized");

    const missing: Array<{ path: string; sha256: string }> = [];
    for (const f of args.files) {
      const existing = await ctx.db
        .query("instructionFiles")
        .withIndex("by_orgId_sha256", (q) => q.eq("orgId", auth.orgId).eq("sha256", f.sha256))
        .unique();
      if (!existing) missing.push({ path: f.path, sha256: f.sha256 });
    }

    return { missing };
  }
});

export const uploadMissing = mutation({
  args: {
    token: v.string(),
    files: v.array(
      v.object({
        path: v.string(),
        sha256: v.string(),
        content: v.string()
      })
    )
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery(api.apiTokens.verify, { token: args.token });
    if (!auth || !auth.orgId) throw new Error("unauthorized");

    let stored = 0;
    for (const f of args.files) {
      const existing = await ctx.db
        .query("instructionFiles")
        .withIndex("by_orgId_sha256", (q) => q.eq("orgId", auth.orgId).eq("sha256", f.sha256))
        .unique();
      if (existing) continue;

      await ctx.db.insert("instructionFiles", {
        orgId: auth.orgId,
        repoId: undefined,
        path: f.path,
        sha256: f.sha256,
        content: f.content,
        createdAtMs: Date.now()
      });
      stored++;
    }

    return { stored };
  }
});
