import { pgTable, text, uuid, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id:            uuid("id").primaryKey().defaultRandom(),
  email:         text("email").unique().notNull(),
  password_hash: text("password_hash").notNull(),
  first_name:    text("first_name"),
  last_name:     text("last_name"),
  full_name:     text("full_name"),
  country:       text("country"),
  avatar_url:    text("avatar_url"),
  created_at:    timestamp("created_at").defaultNow(),
  deleted_at:    timestamp("deleted_at"),
});

export const userProfiles = pgTable("user_profiles", {
  id:                  uuid("id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  knowledge_level:     text("knowledge_level").default("Beginner"),
  risk_profile:        text("risk_profile").default("Moderate"),
  income_bracket:      text("income_bracket"),
  goals:               text("goals"),
  life_stage:          text("life_stage"),
  subscription_tier:   text("subscription_tier").default("Trial"),
  newsletter_enabled:  boolean("newsletter_enabled").default(false),
  avatar_url:          text("avatar_url"),
});

export const portfolioItems = pgTable("portfolio_items", {
  id:           uuid("id").primaryKey().defaultRandom(),
  user_id:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  asset_symbol: text("asset_symbol").notNull(),
  asset_name:   text("asset_name"),
  asset_type:   text("asset_type"),
  asset_sector: text("asset_sector"),
  shares:       numeric("shares").notNull().default("0"),
  created_at:   timestamp("created_at").defaultNow(),
});

export const watchlistItems = pgTable("watchlist_items", {
  id:           uuid("id").primaryKey().defaultRandom(),
  user_id:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  asset_symbol: text("asset_symbol").notNull(),
  asset_name:   text("asset_name"),
  asset_type:   text("asset_type"),
  asset_sector: text("asset_sector"),
  created_at:   timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, created_at: true, deleted_at: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
