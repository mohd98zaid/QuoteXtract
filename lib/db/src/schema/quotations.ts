import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id"),
  supplierName: text("supplier_name"),
  supplierEmail: text("supplier_email"),
  quotationNumber: text("quotation_number"),
  quotationDate: text("quotation_date"),
  currency: text("currency"),
  paymentTerms: text("payment_terms"),
  deliveryTerms: text("delivery_terms"),
  totalAmount: text("total_amount"),
  status: text("status", { enum: ["draft", "reviewed", "approved", "rejected"] })
    .notNull()
    .default("draft"),
  extractionScore: integer("extraction_score"),
  notes: text("notes"),
  pdfStorageKey: text("pdf_storage_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;
