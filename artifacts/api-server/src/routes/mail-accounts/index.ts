import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { 
  db, 
  mailAccountsTable, 
  emailsTable, 
  quotationsTable, 
  quotationItemsTable, 
  quotationEventsTable 
} from "@workspace/db";
import { z } from "zod";
import { logger } from "../../lib/logger";
import fs from "fs";
import path from "path";

const PDF_STORAGE_DIR = "/tmp/quotation-pdfs";

const router: IRouter = Router();

// GET /api/mail-accounts
router.get("/mail-accounts", async (req, res): Promise<void> => {
  const accounts = await db.select().from(mailAccountsTable);
  res.json(accounts);
});

// GET /api/mail-accounts/status
router.get("/mail-accounts/status", async (req, res): Promise<void> => {
  try {
    const { getImapStatusForAccount } = await import("../../lib/imap-poller");
    const accounts = await db.select().from(mailAccountsTable);
    const statuses = accounts.map(acc => ({
      id: acc.id,
      ...getImapStatusForAccount(acc.id)
    }));
    res.json(statuses);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch account statuses");
    res.status(500).json({ error: "Failed to fetch account statuses" });
  }
});

// POST /api/mail-accounts
const createSchema = z.object({
  label: z.string(),
  email: z.string().email(),
  password: z.string(),
  imapHost: z.string(),
  imapPort: z.number(),
  smtpHost: z.string(),
  smtpPort: z.number(),
  fromName: z.string().optional(),
});

router.post("/mail-accounts", async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error });
    return;
  }

  try {
    const [inserted] = await db
      .insert(mailAccountsTable)
      .values({
        ...parsed.data,
        secure: true,
        isActive: true,
      })
      .returning();

    // Kickoff the poller to include this new account
    const { restartPoller } = await import("../../lib/imap-poller");
    restartPoller();

    res.json(inserted);
  } catch (err: any) {
    logger.error({ err }, "Failed to create mail account");
    res.status(400).json({ error: err.message || "Failed to connect mail account" });
  }
});

// DELETE /api/mail-accounts/:id
router.delete("/mail-accounts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const accountId = id;

    // Perform cascaded deletion in a transaction to ensure integrity
    await db.transaction(async (tx) => {
      // 1. Find all emails for this account
      const accountEmails = await tx
        .select({ id: emailsTable.id, pdfStorageKey: emailsTable.pdfStorageKey })
        .from(emailsTable)
        .where(eq(emailsTable.accountId, accountId));

      if (accountEmails.length > 0) {
        const emailIds = accountEmails.map((e) => e.id);

        // 2. Find all quotations for these emails
        const accountQuotations = await tx
          .select({ id: quotationsTable.id, pdfStorageKey: quotationsTable.pdfStorageKey })
          .from(quotationsTable)
          .where(inArray(quotationsTable.emailId, emailIds));

        if (accountQuotations.length > 0) {
          const quotationIds = accountQuotations.map((q) => q.id);

          // 3. Delete dependent quotation data
          await tx.delete(quotationItemsTable).where(inArray(quotationItemsTable.quotationId, quotationIds));
          await tx.delete(quotationEventsTable).where(inArray(quotationEventsTable.quotationId, quotationIds));

          // 4. Delete quotations
          await tx.delete(quotationsTable).where(inArray(quotationsTable.id, quotationIds));

          // Physical cleanup of quotation-specific PDFs (if any)
          for (const q of accountQuotations) {
            if (q.pdfStorageKey) {
              const filePath = path.join(PDF_STORAGE_DIR, q.pdfStorageKey);
              fs.unlink(filePath, (err) => {
                if (err && err.code !== "ENOENT") logger.warn({ err, filePath }, "Failed to delete quotation PDF file during account removal");
              });
            }
          }
        }

        // 5. Delete emails
        await tx.delete(emailsTable).where(inArray(emailsTable.id, emailIds));

        // Physical cleanup of email PDFs
        for (const e of accountEmails) {
          if (e.pdfStorageKey) {
            const filePath = path.join(PDF_STORAGE_DIR, e.pdfStorageKey);
            fs.unlink(filePath, (err) => {
              if (err && err.code !== "ENOENT") logger.warn({ err, filePath }, "Failed to delete email PDF file during account removal");
            });
          }
        }
      }

      // 6. Finally delete the mail account
      await tx.delete(mailAccountsTable).where(eq(mailAccountsTable.id, accountId));
    });

    const { restartPoller } = await import("../../lib/imap-poller");
    restartPoller();

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err, accountId: id }, "Failed to delete mail account and its data");
    res.status(500).json({ error: "Failed to remove mail account", details: err.message });
  }
});

export default router;
