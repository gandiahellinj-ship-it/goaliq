import { pgTable, serial, text, integer, real, timestamp, boolean, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const onboardingProfilesTable = pgTable("onboarding_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  age: integer("age").notNull(),
  sex: text("sex").notNull(),
  heightCm: real("height_cm").notNull(),
  weightKg: real("weight_kg").notNull(),
  goalType: text("goal_type").notNull(),
  dietType: text("diet_type").notNull(),
  allergies: jsonb("allergies").notNull().$type<string[]>(),
  likedFoods: jsonb("liked_foods").notNull().$type<string[]>(),
  dislikedFoods: jsonb("disliked_foods").notNull().$type<string[]>(),
  trainingLevel: text("training_level").notNull(),
  trainingLocation: text("training_location").notNull(),
  trainingDaysPerWeek: integer("training_days_per_week").notNull(),
  targetWeightKg: real("target_weight_kg"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOnboardingProfileSchema = createInsertSchema(onboardingProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOnboardingProfile = z.infer<typeof insertOnboardingProfileSchema>;
export type OnboardingProfile = typeof onboardingProfilesTable.$inferSelect;

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStart: date("week_start").notNull(),
  days: jsonb("days").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export type MealPlan = typeof mealPlansTable.$inferSelect;

export const workoutPlansTable = pgTable("workout_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStart: date("week_start").notNull(),
  days: jsonb("days").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export type WorkoutPlan = typeof workoutPlansTable.$inferSelect;

export const calendarEventsTable = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  eventType: text("event_type").notNull(),
  workoutType: text("workout_type"),
  isCompleted: boolean("is_completed").notNull().default(false),
  notes: text("notes"),
});

export type CalendarEvent = typeof calendarEventsTable.$inferSelect;

export const weightEntriesTable = pgTable("weight_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  weightKg: real("weight_kg").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export type WeightEntry = typeof weightEntriesTable.$inferSelect;
