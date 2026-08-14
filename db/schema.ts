import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role").notNull().unique(),
  name: text("name").notNull(),
  pinSalt: text("pin_salt").notNull(),
  pinHash: text("pin_hash").notNull(),
  color: text("color").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  points: integer("points").notNull().default(1),
  creatorId: integer("creator_id").notNull(),
  assigneeId: integer("assignee_id").notNull(),
  weekStart: text("week_start").notNull(),
  dueDate: text("due_date").notNull(),
  proofRequired: integer("proof_required", { mode: "boolean" })
    .notNull()
    .default(false),
  recurringKey: text("recurring_key"),
  status: text("status").notNull().default("open"),
  proofKey: text("proof_key"),
  completionNote: text("completion_note").notNull().default(""),
  reviewerComment: text("reviewer_comment").notNull().default(""),
  submittedAt: text("submitted_at"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const moneyRequests = sqliteTable("money_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorId: integer("creator_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  purpose: text("purpose").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("pending"),
  parentId: integer("parent_id"),
  conditionTaskId: integer("condition_task_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  badgeKey: text("badge_key").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  unlockedAt: text("unlocked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const rewards = sqliteTable("rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  earnedFromWeek: text("earned_from_week").notNull(),
  rewardWeek: text("reward_week").notNull().unique(),
  status: text("status").notNull().default("unlocked"),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
