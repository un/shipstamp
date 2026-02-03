import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function randomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

function randomBase32(len: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const createdAtMs = Date.now();
    const expiresAtMs = createdAtMs + 10 * 60 * 1000;

    const deviceCode = randomBase32(40);
    const userCodeRaw = randomBase32(8);
    const userCode = `${userCodeRaw.slice(0, 4)}-${userCodeRaw.slice(4)}`;

    await ctx.db.insert("deviceAuthRequests", {
      deviceCode,
      userCode,
      status: "pending",
      createdAtMs,
      expiresAtMs
    });

    return {
      deviceCode,
      userCode,
      expiresAtMs,
      intervalMs: 2000
    };
  }
});

export const approve = mutation({
  args: {
    userCode: v.string(),
    orgId: v.id("orgs")
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId).eq("userId", identity.subject))
      .unique();
    if (!membership) throw new Error("Not a member of that org");

    const req = await ctx.db
      .query("deviceAuthRequests")
      .withIndex("by_userCode", (q) => q.eq("userCode", args.userCode))
      .unique();

    if (!req) throw new Error("Code not found");
    if (Date.now() > req.expiresAtMs) throw new Error("Code expired");
    if (req.status !== "pending") return { ok: true };

    await ctx.db.patch(req._id, {
      status: "approved",
      userId: identity.subject,
      orgId: args.orgId,
      approvedAtMs: Date.now()
    });

    return { ok: true };
  }
});

export const complete = mutation({
  args: {
    deviceCode: v.string()
  },
  handler: async (ctx, args) => {
    const req = await ctx.db
      .query("deviceAuthRequests")
      .withIndex("by_deviceCode", (q) => q.eq("deviceCode", args.deviceCode))
      .unique();

    if (!req) throw new Error("device_code_not_found");
    if (Date.now() > req.expiresAtMs) throw new Error("expired");
    if (req.consumedAtMs) throw new Error("already_consumed");
    if (req.status !== "approved" || !req.userId || !req.orgId) throw new Error("authorization_pending");

    const token = randomBase32(64);
    const tokenHash = await sha256Hex(token);
    const tokenPrefix = token.slice(0, 6);

    await ctx.db.insert("apiTokens", {
      userId: req.userId,
      orgId: req.orgId,
      tokenHash,
      tokenPrefix,
      createdAtMs: Date.now()
    });

    await ctx.db.patch(req._id, {
      status: "consumed",
      tokenHash,
      tokenPrefix,
      consumedAtMs: Date.now()
    });

    return { token };
  }
});

export const listMyTokens = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("apiTokens")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();
  }
});

export const revokeToken = mutation({
  args: {
    tokenPrefix: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const tokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    const now = Date.now();
    for (const t of tokens) {
      if (t.tokenPrefix === args.tokenPrefix && !t.revokedAtMs) {
        await ctx.db.patch(t._id, { revokedAtMs: now });
      }
    }

    return { ok: true };
  }
});
