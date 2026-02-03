import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const DEFAULT_INSTRUCTION_FILENAMES = ["AGENTS.md", "agents.md", "codex.md", "claude.md", ".cursorrules"];

function normalizeInstructionFilenames(input: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const s = raw.trim();
    if (!s) continue;
    // Filenames only (no paths). Allow dotfiles.
    if (s.includes("/") || s.includes("\\")) continue;
    if (s.length > 128) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyApiToken(
  ctx: { db: any },
  token: string
): Promise<{ userId: string; orgId: Id<"orgs"> } | null> {
  const tokenHash = await sha256Hex(token);
  const rec = await ctx.db
    .query("apiTokens")
    .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", tokenHash))
    .unique();

  if (!rec) return null;
  if (rec.revokedAtMs) return null;
  if (!rec.orgId) return null;
  return { userId: rec.userId, orgId: rec.orgId };
}

async function requireOrgAdmin(ctx: any, orgId: Id<"orgs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_orgId_userId", (q: any) => q.eq("orgId", orgId).eq("userId", identity.subject))
    .unique();
  if (!membership) throw new Error("Forbidden");

  const ok = membership.role === "owner" || membership.role === "admin";
  if (!ok) throw new Error("Forbidden");
  return { userId: identity.subject };
}

type SettingsReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

async function getSettings(ctx: SettingsReadCtx, orgId: Id<"orgs">) {
  return await ctx.db
    .query("orgSettings")
    .withIndex("by_orgId", (q: any) => q.eq("orgId", orgId))
    .unique();
}

async function getOrCreateSettings(ctx: MutationCtx, orgId: Id<"orgs">) {
  const existing = await getSettings(ctx, orgId);
  if (existing) return existing;

  const now = Date.now();
  const id = await ctx.db.insert("orgSettings", {
    orgId,
    instructionFilenames: DEFAULT_INSTRUCTION_FILENAMES,
    promptAppend: "",
    createdAtMs: now,
    updatedAtMs: now
  });
  return await ctx.db.get(id);
}

export const getForOrg = query({
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

    const canEdit = membership.role === "owner" || membership.role === "admin";

    const settings = await getSettings(ctx, args.orgId);
    return {
      instructionFilenames: settings?.instructionFilenames ?? DEFAULT_INSTRUCTION_FILENAMES,
      promptAppend: settings?.promptAppend ?? "",
      canEdit
    };
  }
});

export const getForToken = query({
  args: {
    token: v.string()
  },
  handler: async (ctx, args) => {
    const auth = await verifyApiToken(ctx, args.token);
    if (!auth) throw new Error("unauthorized");

    const settings = await getSettings(ctx, auth.orgId);
    return {
      instructionFilenames: settings?.instructionFilenames ?? DEFAULT_INSTRUCTION_FILENAMES,
      promptAppend: settings?.promptAppend ?? ""
    };
  }
});

export const appendPrompt = mutation({
  args: {
    orgId: v.id("orgs"),
    text: v.string()
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);

    const settings = await getOrCreateSettings(ctx, args.orgId);
    if (!settings) throw new Error("failed_to_create_settings");

    const append = args.text.trim();
    if (!append) throw new Error("Empty prompt append");

    const next = settings.promptAppend ? `${settings.promptAppend}\n\n${append}` : append;
    await ctx.db.patch(settings._id, {
      promptAppend: next,
      updatedAtMs: Date.now()
    });
    return { ok: true };
  }
});

export const setInstructionFilenames = mutation({
  args: {
    orgId: v.id("orgs"),
    filenames: v.array(v.string())
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);

    const settings = await getOrCreateSettings(ctx, args.orgId);
    if (!settings) throw new Error("failed_to_create_settings");

    const normalized = normalizeInstructionFilenames(args.filenames);
    if (normalized.length === 0) throw new Error("No valid instruction filenames");

    await ctx.db.patch(settings._id, {
      instructionFilenames: normalized,
      updatedAtMs: Date.now()
    });
    return { ok: true };
  }
});
