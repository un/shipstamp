import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  orgs: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAtMs: v.number()
  }).index("by_slug", ["slug"]),

  users: defineTable({
    githubId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAtMs: v.number()
  }).index("by_githubId", ["githubId"]),

  memberships: defineTable({
    orgId: v.id("orgs"),
    userId: v.id("users"),
    role: v.string(),
    createdAtMs: v.number()
  })
    .index("by_orgId", ["orgId"])
    .index("by_userId", ["userId"])
    .index("by_orgId_userId", ["orgId", "userId"]),

  repos: defineTable({
    orgId: v.id("orgs"),
    originUrl: v.string(),
    normalizedOriginUrl: v.string(),
    defaultBranch: v.string(),
    createdAtMs: v.number()
  })
    .index("by_orgId", ["orgId"])
    .index("by_normalizedOriginUrl", ["normalizedOriginUrl"])
});
