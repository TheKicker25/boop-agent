import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    connectionId: v.string(),
    service: v.string(),
    accountLabel: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    scopes: v.optional(v.array(v.string())),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_connection_id", (q) => q.eq("connectionId", args.connectionId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, status: "active" });
      return existing._id;
    }
    return await ctx.db.insert("connections", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const getByService = query({
  args: { service: v.string() },
  handler: async (ctx, args) => {
    const conns = await ctx.db
      .query("connections")
      .withIndex("by_service", (q) => q.eq("service", args.service))
      .collect();
    return conns.filter((c) => c.status === "active");
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("connections").collect();
  },
});

export const revoke = mutation({
  args: { connectionId: v.string() },
  handler: async (ctx, args) => {
    const conn = await ctx.db
      .query("connections")
      .withIndex("by_connection_id", (q) => q.eq("connectionId", args.connectionId))
      .unique();
    if (!conn) return null;
    await ctx.db.patch(conn._id, { status: "revoked" });
    return conn._id;
  },
});
