import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { simpleParser } from "mailparser";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, emailsTable, quotationsTable, quotationItemsTable } from "@workspace/db";
import { extractFromPdf } from "../../lib/pdf-extractor";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const uploadDir = "/tmp/quotation-pdfs";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, _file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}.pdf`);
  },
});

const multipartUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function checkWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["WEBHOOK_SECRET"];
  if (!secret) {
    next();
    return;
  }
  const provided =
    (req.headers["x-webhook-secret"] as string | undefined) ||
    (req.query["secret"] as string | undefined);
  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }
  next();
}

async function processAndExtract(emailId: number, storageKey: string): Promise<void> {
  try {
    logger.info({ emailId, storageKey }, "Auto-extracting from webhook email");
    const extracted = await extractFromPdf(storageKey);

    const [quotation] = await db
      .insert(quotationsTable)
      .values({
        emailId,
        supplierName: extracted.supplierName,
        supplierEmail: extracted.supplierEmail,
        quotationNumber: extracted.quotationNumber,
        quotationDate: extracted.quotationDate,
        currency: extracted.currency,
        paymentTerms: extracted.paymentTerms,
        deliveryTerms: extracted.deliveryTerms,
        totalAmount: extracted.totalAmount,
        extractionScore: extracted.extractionScore,
        pdfStorageKey: storageKey,
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

    await db.update(emailsTable).set({ status: "extracted" }).where(eq(emailsTable.id, emailId));
    logger.info({ emailId, quotationId: quotation.id }, "Webhook auto-extraction complete");
  } catch (err) {
    logger.error({ err, emailId }, "Webhook auto-extraction failed");
    await db.update(emailsTable).set({ status: "failed" }).where(eq(emailsTable.id, emailId));
  }
}

// Raw body reader middleware (for Hostinger cPanel email pipe)
function rawBodyReader(req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
}

// ── POST /api/webhooks/email/raw ──────────────────────────────────────────
// Hostinger cPanel email pipe — sends the full raw RFC 822 email as the body.
// Configure in Hostinger hPanel: Email → Email Accounts → Forwarders/Piping
// Set pipe destination to: https://yourdomain.com/api/webhooks/email/raw
router.post(
  "/webhooks/email/raw",
  checkWebhookSecret,
  rawBodyReader,
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const rawEmail = req.rawBody;
    if (!rawEmail || rawEmail.length === 0) {
      res.status(400).json({ error: "Empty email body" });
      return;
    }

    let parsed;
    try {
      parsed = await simpleParser(rawEmail);
    } catch (err) {
      req.log.error({ err }, "Failed to parse raw email");
      res.status(400).json({ error: "Failed to parse email" });
      return;
    }

    const senderName = parsed.from?.value[0]?.name || null;
    const senderEmail = parsed.from?.value[0]?.address || null;
    const subject = parsed.subject || null;
    const receivedAt = parsed.date?.toISOString() || new Date().toISOString();

    const pdfAttachments = (parsed.attachments || []).filter(
      (a) => a.contentType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf"),
    );

    if (pdfAttachments.length === 0) {
      req.log.warn({ senderEmail, subject }, "Webhook email has no PDF attachment");
      res.status(200).json({ message: "Email received, no PDF attachment found" });
      return;
    }

    const results: { emailId: number; filename: string }[] = [];

    for (const attachment of pdfAttachments) {
      const storageKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
      const filePath = path.join(uploadDir, storageKey);
      fs.writeFileSync(filePath, attachment.content);

      const [emailRecord] = await db
        .insert(emailsTable)
        .values({
          senderName,
          senderEmail,
          subject,
          receivedAt,
          pdfFilename: attachment.filename || "attachment.pdf",
          pdfStorageKey: storageKey,
          status: "processing",
        })
        .returning();

      req.log.info({ emailId: emailRecord.id, storageKey, senderEmail }, "Raw email stored, triggering extraction");

      // Fire-and-forget
      processAndExtract(emailRecord.id, storageKey).catch(() => {});

      results.push({ emailId: emailRecord.id, filename: attachment.filename || "attachment.pdf" });
    }

    res.status(200).json({ received: true, processed: results.length, results });
  },
);

// ── POST /api/webhooks/email ──────────────────────────────────────────────
// Mailgun / SendGrid Inbound Parse style: multipart form with fields + attachments.
// Also useful for custom forwarders.
router.post(
  "/webhooks/email",
  checkWebhookSecret,
  multipartUpload.array("attachment", 10),
  async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[] | undefined;
    const senderEmail: string | null = req.body?.from || req.body?.sender || null;
    const senderName: string | null = req.body?.["sender-name"] || null;
    const subject: string | null = req.body?.subject || null;
    const receivedAt: string = req.body?.date || new Date().toISOString();

    // Also handle JSON body with base64-encoded PDF (alternative format)
    if (!files?.length && req.body?.pdf_base64) {
      const buf = Buffer.from(req.body.pdf_base64, "base64");
      const storageKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
      fs.writeFileSync(path.join(uploadDir, storageKey), buf);

      const [emailRecord] = await db
        .insert(emailsTable)
        .values({
          senderName,
          senderEmail,
          subject,
          receivedAt,
          pdfFilename: req.body?.filename || "attachment.pdf",
          pdfStorageKey: storageKey,
          status: "processing",
        })
        .returning();

      processAndExtract(emailRecord.id, storageKey).catch(() => {});
      res.status(200).json({ received: true, processed: 1 });
      return;
    }

    const pdfFiles = (files || []).filter(
      (f) => f.mimetype === "application/pdf" || f.originalname?.toLowerCase().endsWith(".pdf"),
    );

    if (pdfFiles.length === 0) {
      req.log.warn({ senderEmail, subject }, "Multipart webhook: no PDF attachment");
      res.status(200).json({ message: "Received, no PDF attachment to process" });
      return;
    }

    const results: { emailId: number; filename: string }[] = [];

    for (const file of pdfFiles) {
      const [emailRecord] = await db
        .insert(emailsTable)
        .values({
          senderName,
          senderEmail,
          subject,
          receivedAt,
          pdfFilename: file.originalname,
          pdfStorageKey: file.filename,
          status: "processing",
        })
        .returning();

      req.log.info({ emailId: emailRecord.id, storageKey: file.filename, senderEmail }, "Multipart webhook email stored");

      processAndExtract(emailRecord.id, file.filename).catch(() => {});
      results.push({ emailId: emailRecord.id, filename: file.originalname });
    }

    res.status(200).json({ received: true, processed: results.length, results });
  },
);

// ── GET /api/webhooks/config ──────────────────────────────────────────────
// Returns webhook URLs and setup instructions for the UI.
router.get("/webhooks/config", (req: Request, res: Response): void => {
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || `localhost:${process.env["PORT"]}`;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${host}`;
  const hasSecret = !!process.env["WEBHOOK_SECRET"];

  res.json({
    rawEmailUrl: `${baseUrl}/api/webhooks/email/raw`,
    multipartUrl: `${baseUrl}/api/webhooks/email`,
    secretRequired: hasSecret,
    hostingerSetup: [
      "1. Log in to Hostinger hPanel → Emails → Email Accounts",
      "2. Click on your email account → go to Forwarders",
      "3. Create a forwarder to a pipe script, OR use hPanel → Advanced → Email Routing",
      "4. Alternatively: set up a Hostinger webhook using their Pipe to Program feature",
      `5. Use this URL: ${baseUrl}/api/webhooks/email/raw${hasSecret ? "?secret=YOUR_WEBHOOK_SECRET" : ""}`,
      "6. Any email with a PDF attachment will be auto-extracted and appear in your inbox",
    ],
  });
});

export default router;
