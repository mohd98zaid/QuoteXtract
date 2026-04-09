import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotationItemsTable = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").notNull(),
  partNumber: text("part_number"),
  description: text("description"),
  quantity: text("quantity"),
  unitPrice: text("unit_price"),
  totalPrice: text("total_price"),
  leadTime: text("lead_time"),
  moq: text("moq"),
  currency: text("currency"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQuotationItemSchema = createInsertSchema(quotationItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;
export type QuotationItem = typeof quotationItemsTable.$inferSelect;
