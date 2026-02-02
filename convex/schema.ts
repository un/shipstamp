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
    .index("by_normalizedOriginUrl", ["normalizedOriginUrl"]),

  instructionFiles: defineTable({
    orgId: v.id("orgs"),
    repoId: v.optional(v.id("repos")),
    path: v.string(),
    sha256: v.string(),
    content: v.string(),
    createdAtMs: v.number()
  })
    .index("by_orgId_sha256", ["orgId", "sha256"])
    .index("by_sha256", ["sha256"]),

  reviewRuns: defineTable({
    orgId: v.id("orgs"),
    repoId: v.id("repos"),
    branch: v.string(),
    status: v.string(),
    planTier: v.string(),
    modelSet: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    createdAtMs: v.number()
  })
    .index("by_repoId", ["repoId"])
    .index("by_orgId_createdAtMs", ["orgId", "createdAtMs"]),

  findings: defineTable({
    reviewRunId: v.id("reviewRuns"),
    path: v.string(),
    severity: v.string(),
    title: v.string(),
    message: v.string(),
    suggestion: v.optional(v.string()),
    line: v.optional(v.number()),
    agreementAgreed: v.optional(v.number()),
    agreementTotal: v.optional(v.number())
  }).index("by_reviewRunId", ["reviewRunId"]),

  usageDaily: defineTable({
    orgId: v.id("orgs"),
    userId: v.id("users"),
    day: v.string(),
    count: v.number()
  })
    .index("by_orgId_day", ["orgId", "day"])
    .index("by_userId_day", ["userId", "day"]),

  modelStats: defineTable({
    orgId: v.id("orgs"),
    model: v.string(),
    day: v.string(),
    runs: v.number(),
    findings: v.number(),
    avgLatencyMs: v.optional(v.number())
  }).index("by_orgId_day_model", ["orgId", "day", "model"]),

  orgInvites: defineTable({
    orgId: v.id("orgs"),
    email: v.string(),
    code: v.string(),
    role: v.string(),
    invitedByUserId: v.optional(v.string()),
    createdAtMs: v.number(),
    expiresAtMs: v.number(),
    acceptedAtMs: v.optional(v.number()),
    acceptedUserId: v.optional(v.string())
  })
    .index("by_orgId", ["orgId"])
    .index("by_email", ["email"])
    .index("by_code", ["code"])
    .index("by_orgId_email", ["orgId", "email"]),

  deviceAuthRequests: defineTable({
    deviceCode: v.string(),
    userCode: v.string(),
    status: v.string(),
    userId: v.optional(v.string()),
    orgId: v.optional(v.id("orgs")),
    tokenHash: v.optional(v.string()),
    tokenPrefix: v.optional(v.string()),
    createdAtMs: v.number(),
    expiresAtMs: v.number(),
    approvedAtMs: v.optional(v.number()),
    consumedAtMs: v.optional(v.number())
  })
    .index("by_deviceCode", ["deviceCode"])
    .index("by_userCode", ["userCode"])
    .index("by_status", ["status"]),

  apiTokens: defineTable({
    userId: v.string(),
    orgId: v.optional(v.id("orgs")),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    createdAtMs: v.number(),
    revokedAtMs: v.optional(v.number())
  })
    .index("by_userId", ["userId"])
    .index("by_tokenHash", ["tokenHash"])
});
