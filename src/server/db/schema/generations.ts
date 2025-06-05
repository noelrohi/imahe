import type { Images } from "@/types";
import { relations } from "drizzle-orm";
import { index, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { pgTable } from "../creator";
import { user } from "./auth";

export const generations = pgTable(
  "generations",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    url: text("url").notNull(),
    contentType: text("content_type"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    width: integer("width"),
    height: integer("height"),
    prompt: text("prompt"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("request_id_unique").on(table.requestId)],
);

export const generationRelations = relations(generations, ({ one }) => ({
  user: one(user, {
    fields: [generations.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  generations: many(generations),
}));
