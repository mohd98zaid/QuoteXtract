import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const quotationEventsTable = pgTable("quotation_events", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  eventType: text("event_type", {
    enum: ["created", "status_changed", "updated", "re_extracted", "item_added", "item_deleted"] as const,
  }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuotationEvent = typeof quotationEventsTable.$inferSelect;
