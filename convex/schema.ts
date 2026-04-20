import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const captureSettings = v.object({
  urlMode: v.union(v.literal("domain_only"), v.literal("sanitized_path")),
  titleMode: v.union(v.literal("off"), v.literal("normalized")),
  blockedDomains: v.array(v.string()),
  sensitiveDomains: v.array(v.string()),
  maxPathSegments: v.number(),
});

const reviewSettings = v.object({
  collapseMicroBlocks: v.boolean(),
  defaultReviewMode: v.union(
    v.literal("all"),
    v.literal("uncategorized"),
    v.literal("micro"),
  ),
});

const teamSettings = v.object({
  idleThresholdMs: v.number(),
  mergeGapMs: v.number(),
  microBlockThresholdMs: v.number(),
  urlCaptureMode: v.union(v.literal("domain_only"), v.literal("sanitized_path")),
  titleCaptureMode: v.union(v.literal("off"), v.literal("normalized")),
});

const ruleCondition = v.object({
  domain: v.optional(v.string()),
  pathnamePrefix: v.optional(v.string()),
  titleContains: v.optional(v.string()),
  exactTitle: v.optional(v.string()),
});

const featureSnapshot = v.object({
  featureType: v.union(
    v.literal("domain"),
    v.literal("pathnamePrefix"),
    v.literal("exactTitle"),
    v.literal("titleContains"),
    v.literal("domain+pathnamePrefix"),
    v.literal("domain+titleContains"),
  ),
  featureValue: v.string(),
});

export default defineSchema({
  users: defineTable({
    authSubject: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    defaultTeamId: v.optional(v.id("teams")),
    timezone: v.string(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_auth_subject", ["authSubject"])
    .index("by_email", ["email"]),

  teams: defineTable({
    name: v.string(),
    slug: v.string(),
    createdByUserId: v.id("users"),
    settings: teamSettings,
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  memberships: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    status: v.union(v.literal("active"), v.literal("invited")),
    joinedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_user", ["teamId", "userId"]),

  teamInvites: defineTable({
    teamId: v.id("teams"),
    email: v.optional(v.string()),
    tokenHash: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_team", ["teamId"]),

  projects: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    code: v.optional(v.string()),
    color: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_team_status", ["teamId", "status"])
    .index("by_team_name", ["teamId", "name"]),

  userSettings: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    capture: captureSettings,
    review: reviewSettings,
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_team", ["userId", "teamId"]),

  devices: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    label: v.string(),
    kind: v.string(),
    platform: v.string(),
    extensionVersion: v.string(),
    tokenHash: v.string(),
    permissions: v.array(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user", ["userId"]),

  pairingCodes: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    codeHash: v.string(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_code_hash", ["codeHash"])
    .index("by_user", ["userId"]),

  activitySegments: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    deviceId: v.id("devices"),
    externalSegmentId: v.string(),
    source: v.literal("browser_extension"),
    localDate: v.string(),
    domain: v.string(),
    pathname: v.string(),
    url: v.string(),
    title: v.string(),
    startedAt: v.number(),
    endedAt: v.number(),
    activeDurationMs: v.number(),
    idleDurationMs: v.number(),
    isIdleSplit: v.boolean(),
    capturedUrlMode: v.union(v.literal("domain_only"), v.literal("sanitized_path")),
    createdAt: v.number(),
  })
    .index("by_user_started_at", ["userId", "startedAt"])
    .index("by_user_local_date", ["userId", "localDate"])
    .index("by_device_external_id", ["deviceId", "externalSegmentId"]),

  activityBlocks: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    localDate: v.string(),
    startedAt: v.number(),
    endedAt: v.number(),
    durationMs: v.number(),
    sourceSegmentIds: v.array(v.string()),
    fingerprint: v.string(),
    display: v.object({
      label: v.string(),
      subtitle: v.string(),
    }),
    status: v.union(
      v.literal("draft"),
      v.literal("suggested"),
      v.literal("edited"),
      v.literal("confirmed"),
    ),
    projectId: v.optional(v.id("projects")),
    assignmentSource: v.union(
      v.literal("none"),
      v.literal("manual"),
      v.literal("rule"),
      v.literal("history"),
      v.literal("auto"),
    ),
    confidence: v.number(),
    explanation: v.optional(v.string()),
    note: v.optional(v.string()),
    isMicroBlock: v.boolean(),
    locked: v.boolean(),
    domain: v.string(),
    pathname: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    confirmedAt: v.optional(v.number()),
  })
    .index("by_user_local_date", ["userId", "localDate"])
    .index("by_user_status", ["userId", "status"]),

  timelineDays: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    localDate: v.string(),
    status: v.union(v.literal("open"), v.literal("confirmed"), v.literal("reopened")),
    trackedMs: v.number(),
    confirmedMs: v.number(),
    lastAggregatedAt: v.number(),
    confirmedAt: v.optional(v.number()),
  })
    .index("by_user_local_date", ["userId", "localDate"])
    .index("by_team_local_date", ["teamId", "localDate"]),

  categorizationRules: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    enabled: v.boolean(),
    priority: v.number(),
    source: v.union(v.literal("manual"), v.literal("learned")),
    status: v.union(v.literal("active"), v.literal("pending"), v.literal("rejected")),
    action: v.union(v.literal("suggest"), v.literal("auto_assign")),
    targetProjectId: v.id("projects"),
    condition: ruleCondition,
    baseConfidence: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMatchedAt: v.optional(v.number()),
  })
    .index("by_user_enabled_priority", ["userId", "enabled", "priority"])
    .index("by_user_status", ["userId", "status"]),

  ruleProposals: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    targetProjectId: v.id("projects"),
    condition: ruleCondition,
    evidenceCount: v.number(),
    precision: v.number(),
    sampleBlockIds: v.array(v.id("activityBlocks")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
    generatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  }).index("by_user_status", ["userId", "status"]),

  learningFeatureStats: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    featureType: featureSnapshot.fields.featureType,
    featureValue: v.string(),
    projectId: v.id("projects"),
    matchCount: v.number(),
    lastMatchedAt: v.optional(v.number()),
  })
    .index("by_user_feature", ["userId", "featureType", "featureValue"])
    .index("by_user_feature_project", ["userId", "featureType", "featureValue", "projectId"]),

  assignmentFeedback: defineTable({
    userId: v.id("users"),
    teamId: v.id("teams"),
    blockId: v.id("activityBlocks"),
    projectId: v.id("projects"),
    action: v.union(
      v.literal("manual_assign"),
      v.literal("accepted_suggestion"),
      v.literal("changed_suggestion"),
    ),
    suggestedProjectId: v.optional(v.id("projects")),
    ruleId: v.optional(v.id("categorizationRules")),
    featureSnapshot: v.array(featureSnapshot),
    createdAt: v.number(),
  })
    .index("by_user_created_at", ["userId", "createdAt"])
    .index("by_user_project", ["userId", "projectId"]),
});
