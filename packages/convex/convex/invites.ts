import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function randomBase32(len: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

async function requireMembership(ctx: any, orgId: any, userId: string) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_userId", (q: any) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (!membership) throw new Error("Not a member of this org");
  return membership;
}

export const listForMyEmail = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email?.toLowerCase();
    if (!email) return [];

    const now = Date.now();
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    const out: Array<{ invite: any; org: any }> = [];
    for (const inv of invites) {
      if (inv.acceptedAtMs) continue;
      if (inv.expiresAtMs <= now) continue;
      const org = await ctx.db.get(inv.orgId);
      if (!org) continue;
      out.push({ invite: inv, org });
    }

    return out;
  }
});

export const create = mutation({
  args: {
    orgId: v.id("orgs"),
    email: v.string(),
    role: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const membership = await requireMembership(ctx, args.orgId, identity.subject);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw new Error("Insufficient permissions");
    }

    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Invalid email");

    // Try a few times to avoid code collisions.
    let code = "";
    for (let i = 0; i < 5; i++) {
      const raw = randomBase32(10);
      code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
      const exists = await ctx.db
        .query("orgInvites")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (!exists) break;
    }
    if (!code) throw new Error("Failed to generate invite code");

    const now = Date.now();
    const expiresAtMs = now + 7 * 24 * 60 * 60 * 1000;

    const inviteId = await ctx.db.insert("orgInvites", {
      orgId: args.orgId,
      email,
      code,
      role: args.role ?? "member",
      invitedByUserId: identity.subject,
      createdAtMs: now,
      expiresAtMs
    });

    return { inviteId, code, expiresAtMs };
  }
});

export const acceptByCode = mutation({
  args: {
    code: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const code = args.code.trim().toUpperCase();
    const inv = await ctx.db
      .query("orgInvites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!inv) throw new Error("Invite not found");

    const now = Date.now();
    if (inv.expiresAtMs <= now) throw new Error("Invite expired");

    // Idempotency: if already accepted, just ensure membership.
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_orgId_userId", (q) => q.eq("orgId", inv.orgId).eq("userId", identity.subject))
      .unique();

    if (!existingMembership) {
      await ctx.db.insert("memberships", {
        orgId: inv.orgId,
        userId: identity.subject,
        role: inv.role,
        createdAtMs: now
      });
    }

    if (!inv.acceptedAtMs) {
      await ctx.db.patch(inv._id, {
        acceptedAtMs: now,
        acceptedUserId: identity.subject
      });
    }

    return { orgId: inv.orgId };
  }
});
