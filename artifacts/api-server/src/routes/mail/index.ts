import { Router, type IRouter } from "express";
import { eq, desc, and, inArray } from "drizzle-orm";
import { db, emailsTable, quotationsTable, quotationItemsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-local-ai-server";
import { z } from "zod";
import { extractFromPdf } from "../../lib/pdf-extractor";
import { logger } from "../../lib/logger";
import { restartPoller, restorePdfFromImap, runScan } from "../../lib/imap-poller";

const router: IRouter = Router();

// ── GET /api/mail ──────────────────────────────────────────────────────────
// List emails by source. ?source=sent for sent, otherwise imap.
router.get("/mail", async (req, res): Promise<void> => {
  const source = req.query.source === "sent" ? "sent" : "imap";
  const emails = await db
    .select({
      id: emailsTable.id,
      senderName: emailsTable.senderName,
      senderEmail: emailsTable.senderEmail,
      recipientEmail: emailsTable.recipientEmail,
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
    .where(eq(emailsTable.source, source))
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
    .where(and(eq(emailsTable.id, id), inArray(emailsTable.source, ["imap", "sent"])));

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  // Mark as read
  if (!email.isRead) {
    await db.update(emailsTable).set({ isRead: true }).where(eq(emailsTable.id, id));
  }

  // Check if quotation already tracked (only relevant for imap/upload)
  let quotationId: number | null = null;
  if (email.source !== "sent") {
    const [existingQuotation] = await db
      .select({ id: quotationsTable.id })
      .from(quotationsTable)
      .where(eq(quotationsTable.emailId, id));
    quotationId = existingQuotation?.id ?? null;
  }

  res.json({
    ...email,
    isRead: true,
    quotationId,
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

  // If the PDF file is missing from /tmp (e.g. server restarted), try to restore
  // it from IMAP before attempting extraction.
  const fs = await import("fs");
  const path = await import("path");
  const pdfPath = path.join("/tmp/quotation-pdfs", email.pdfStorageKey);
  if (!fs.existsSync(pdfPath)) {
    req.log.warn({ emailId: id, pdfStorageKey: email.pdfStorageKey }, "PDF missing from disk — attempting IMAP restore");
    if (email.messageId) {
      const restored = await restorePdfFromImap(email.messageId, email.pdfStorageKey);
      if (!restored) {
        req.log.error({ emailId: id }, "IMAP restore failed — PDF unavailable");
        await db.update(emailsTable).set({ status: "failed" }).where(eq(emailsTable.id, id));
        res.status(500).json({ error: "Could not retrieve the PDF — the original email may have been deleted from your inbox." });
        return;
      }
    } else {
      await db.update(emailsTable).set({ status: "failed" }).where(eq(emailsTable.id, id));
      res.status(500).json({ error: "PDF file is no longer available." });
      return;
    }
  }

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

// ── POST /api/mail/fetch ────────────────────────────────────────────────────
// Manually trigger an immediate IMAP poll (fire-and-forget)
router.post("/mail/fetch", (_req, res): void => {
  restartPoller();
  logger.info("Manual IMAP fetch triggered");
  res.json({ success: true, message: "Fetch started" });
});

// ── POST /api/mail/scan ────────────────────────────────────────────────────
// Await a full IMAP scan and return { fetched, connected, error }
// Deduplication via messageId ensures no duplicates are created.
router.post("/mail/scan", async (_req, res): Promise<void> => {
  logger.info("Manual IMAP scan started");
  const result = await runScan();
  logger.info(result, "Manual IMAP scan complete");
  res.json({ success: true, ...result });
});

// ── POST /api/mail/enhance ──────────────────────────────────────────────────
// Enhance a draft email, generating a smart polite reply using the local AI.
const EnhanceMailSchema = z.object({
  draftText: z.string(),
  originalText: z.string().optional(),
});

router.post("/mail/enhance", async (req, res): Promise<void> => {
  try {
    const parsed = EnhanceMailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues, code: "VALIDATION_ERROR" });
      return;
    }

    const { draftText, originalText } = parsed.data;

    const MODEL = process.env.LOCAL_AI_MODEL ?? "gpt-4o";

    const systemPrompt = `You are an expert business communication assistant. 
Your job is to take a rough draft and rewrite it into a polite, professional corporate email.
If an original email is provided, ensure your rewritten draft directly answers its contexts perfectly.
CRITICAL: Only output the final email text. Do not include greetings like "Sure, here is the rewritten email:", "Okay", or quotation marks wrapping the whole response. Do not output subject lines unless absolutely needed.`;

    const userPrompt = `ORIGINAL EMAIL CONTEXT:
${originalText ? originalText : "None provided."}

MY ROUGH DRAFT:
${draftText}

Please refine my draft into a clean, professional email ready to send.`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const enhanced = response.choices[0]?.message?.content?.trim() || "Failed to generate reply.";

    res.json({ enhanced });
  } catch (err: any) {
    req.log.error(err, "Mail enhance error");
    res.status(500).json({ error: "Failed to enhance email" });
  }
});

export default router;
