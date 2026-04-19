import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { mailAccountsTable } from "./mailAccounts";

export const emailsTable = pgTable("emails", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => mailAccountsTable.id),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  subject: text("subject"),
  receivedAt: text("received_at"),
  pdfFilename: text("pdf_filename"),
  pdfStorageKey: text("pdf_storage_key"),
  pdfSha256: text("pdf_sha256"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  isRead: boolean("is_read").notNull().default(false),
  messageId: text("message_id"),
  source: text("source", { enum: ["upload", "imap", "webhook", "sent"] as const }).notNull().default("upload"),
  recipientEmail: text("recipient_email"),
  status: text("status", { enum: ["pending", "processing", "extracted", "failed"] as const })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertEmailSchema = createInsertSchema(emailsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emailsTable.$inferSelect;
