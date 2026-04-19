import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mailAccountsTable = pgTable("mail_accounts", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fromName: text("from_name"),
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  secure: boolean("secure").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMailAccountSchema = createInsertSchema(mailAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMailAccount = z.infer<typeof insertMailAccountSchema>;
export type MailAccount = typeof mailAccountsTable.$inferSelect;
