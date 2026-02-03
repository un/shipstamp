import { query } from "./_generated/server";
import { v } from "convex/values";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const verify = query({
  args: {
    token: v.string()
  },
  handler: async (ctx, args) => {
    const tokenHash = await sha256Hex(args.token);
    const rec = await ctx.db
      .query("apiTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (!rec) return null;
    if (rec.revokedAtMs) return null;
    if (!rec.orgId) return null;
    return { userId: rec.userId, orgId: rec.orgId };
  }
});
