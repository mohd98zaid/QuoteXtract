import { Router, type IRouter } from "express";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { db, emailsTable, quotationsTable, quotationItemsTable } from "@workspace/db";
import { extractFromPdf } from "../../lib/pdf-extractor";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// ── GET /api/mail ──────────────────────────────────────────────────────────
// List all IMAP emails (source = 'imap'), sorted newest first
router.get("/mail", async (req, res): Promise<void> => {
  const emails = await db
    .select({
      id: emailsTable.id,
      senderName: emailsTable.senderName,
      senderEmail: emailsTable.senderEmail,
      subject: emailsTable.subject,
      receivedAt: emailsTable.receivedAt,
      pdfFilename: emailsTable.pdfFilename,
      pdfStorageKey: emailsTable.pdfStorageKey,
      isRead: emailsTable.isRead,
      status: emailsTable.status,
      source: emailsTable.source,
      bodyText: emailsTable.bodyText,
      createdAt: emailsTable.createdAt,
    })
    .from(emailsTable)
    .where(eq(emailsTable.source, "imap"))
    .orderBy(desc(emailsTable.createdAt));

  res.json(emails);
});

// ── GET /api/mail/:id ──────────────────────────────────────────────────────
// Get a single email with full body
router.get("/mail/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid email ID" });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(and(eq(emailsTable.id, id), eq(emailsTable.source, "imap")));

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  // Mark as read
  if (!email.isRead) {
    await db.update(emailsTable).set({ isRead: true }).where(eq(emailsTable.id, id));
  }

  // Check if quotation already tracked
  const [existingQuotation] = await db
    .select({ id: quotationsTable.id })
    .from(quotationsTable)
    .where(eq(quotationsTable.emailId, id));

  res.json({
    ...email,
    isRead: true,
    quotationId: existingQuotation?.id ?? null,
  });
});

// ── POST /api/mail/:id/track ───────────────────────────────────────────────
// Trigger AI extraction for this email's PDF and create a quotation record
router.post("/mail/:id/track", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid email ID" });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(and(eq(emailsTable.id, id), eq(emailsTable.source, "imap")));

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  if (!email.pdfStorageKey) {
    res.status(400).json({ error: "This email has no PDF attachment" });
    return;
  }

  // Check if already tracked
  const [existing] = await db
    .select({ id: quotationsTable.id })
    .from(quotationsTable)
    .where(eq(quotationsTable.emailId, id));

  if (existing) {
    res.json({ quotationId: existing.id, alreadyTracked: true });
    return;
  }

  await db.update(emailsTable).set({ status: "processing" }).where(eq(emailsTable.id, id));

  req.log.info({ emailId: id, pdfStorageKey: email.pdfStorageKey }, "Tracking PDF from mail");

  let extracted;
  try {
    extracted = await extractFromPdf(email.pdfStorageKey);
  } catch (err) {
    req.log.error({ err, emailId: id }, "Extraction failed");
    await db.update(emailsTable).set({ status: "failed" }).where(eq(emailsTable.id, id));
    res.status(500).json({ error: "PDF extraction failed" });
    return;
  }

  const [quotation] = await db
    .insert(quotationsTable)
    .values({
      emailId: id,
      supplierName: extracted.supplierName,
      supplierEmail: extracted.supplierEmail,
      quotationNumber: extracted.quotationNumber,
      quotationDate: extracted.quotationDate,
      currency: extracted.currency,
      paymentTerms: extracted.paymentTerms,
      deliveryTerms: extracted.deliveryTerms,
      totalAmount: extracted.totalAmount,
      extractionScore: extracted.extractionScore,
      pdfStorageKey: email.pdfStorageKey,
      status: "draft",
    })
    .returning();

  if (extracted.items.length > 0) {
    await db.insert(quotationItemsTable).values(
      extracted.items.map((item) => ({
        quotationId: quotation.id,
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        leadTime: item.leadTime,
        moq: item.moq,
        currency: item.currency ?? extracted.currency,
        notes: item.notes,
      })),
    );
  }

  await db.update(emailsTable).set({ status: "extracted" }).where(eq(emailsTable.id, id));

  req.log.info({ emailId: id, quotationId: quotation.id }, "PDF tracked successfully");
  res.json({ quotationId: quotation.id, alreadyTracked: false });
});

// ── POST /api/mail/:id/read ────────────────────────────────────────────────
// Mark email as read
router.post("/mail/:id/read", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid email ID" });
    return;
  }
  await db.update(emailsTable).set({ isRead: true }).where(eq(emailsTable.id, id));
  res.json({ success: true });
});

export default router;
