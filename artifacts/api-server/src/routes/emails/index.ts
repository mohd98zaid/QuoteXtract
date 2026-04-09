import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, emailsTable, quotationsTable, quotationItemsTable } from "@workspace/db";
import {
  CreateEmailBody,
  GetEmailParams,
} from "@workspace/api-zod";
import { logger } from "../../lib/logger";
import fs from "fs/promises";

const router: IRouter = Router();

router.get("/emails", async (req, res): Promise<void> => {
  const emails = await db
    .select()
    .from(emailsTable)
    .orderBy(emailsTable.createdAt);
  res.json(emails);
});

router.post("/emails", async (req, res): Promise<void> => {
  const parsed = CreateEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [email] = await db.insert(emailsTable).values(parsed.data).returning();
  req.log.info({ emailId: email.id }, "Email record created");
  res.status(201).json(email);
});

router.get("/emails/:id", async (req, res): Promise<void> => {
  const params = GetEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(eq(emailsTable.id, params.data.id));

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  res.json(email);
});

router.delete("/emails/bulk", async (req, res): Promise<void> => {
  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }
  const numIds: number[] = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    res.status(400).json({ error: "No valid ids provided" });
    return;
  }

  const allEmails = await db
    .select()
    .from(emailsTable)
    .where(inArray(emailsTable.id, numIds));

  for (const email of allEmails) {
    const linkedQuotations = await db
      .select({ id: quotationsTable.id })
      .from(quotationsTable)
      .where(eq(quotationsTable.emailId, email.id));
    for (const q of linkedQuotations) {
      await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, q.id));
    }
    await db.delete(quotationsTable).where(eq(quotationsTable.emailId, email.id));
  }

  await db.delete(emailsTable).where(inArray(emailsTable.id, numIds));

  for (const email of allEmails) {
    if (email.pdfStorageKey) {
      await fs.unlink(`/tmp/quotation-pdfs/${email.pdfStorageKey}`).catch(() => {});
    }
  }

  req.log.info({ count: allEmails.length }, "Bulk deleted emails");
  res.json({ success: true, deleted: allEmails.length });
});

router.delete("/emails/:id", async (req, res): Promise<void> => {
  const params = GetEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(eq(emailsTable.id, params.data.id));

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  const linkedQuotations = await db
    .select({ id: quotationsTable.id })
    .from(quotationsTable)
    .where(eq(quotationsTable.emailId, email.id));

  for (const q of linkedQuotations) {
    await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, q.id));
  }
  await db.delete(quotationsTable).where(eq(quotationsTable.emailId, email.id));
  await db.delete(emailsTable).where(eq(emailsTable.id, email.id));

  if (email.pdfStorageKey) {
    const filePath = `/tmp/quotation-pdfs/${email.pdfStorageKey}`;
    await fs.unlink(filePath).catch(() => {});
  }

  req.log.info({ emailId: email.id }, "Email and associated records deleted");
  res.json({ success: true });
});

export default router;
