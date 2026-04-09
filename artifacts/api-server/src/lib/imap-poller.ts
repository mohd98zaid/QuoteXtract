import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import fs from "fs";
import path from "path";
import { db, emailsTable, quotationsTable, quotationItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractFromPdf } from "./pdf-extractor";
import { logger } from "./logger";

const uploadDir = "/tmp/quotation-pdfs";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export interface ImapStatus {
  enabled: boolean;
  connected: boolean;
  lastCheck: string | null;
  lastError: string | null;
  host: string;
  port: number;
  email: string | null;
  pollIntervalSeconds: number;
}

let status: ImapStatus = {
  enabled: false,
  connected: false,
  lastCheck: null,
  lastError: null,
  host: process.env["IMAP_HOST"] || "imap.hostinger.com",
  port: Number(process.env["IMAP_PORT"] || 993),
  email: process.env["IMAP_EMAIL"] || null,
  pollIntervalSeconds: Number(process.env["IMAP_POLL_INTERVAL"] || 60),
};

export function getImapStatus(): ImapStatus {
  return { ...status };
}

async function processEmailMessage(
  raw: Buffer,
  uid: string,
): Promise<void> {
  let parsed;
  try {
    parsed = await simpleParser(raw);
  } catch (err) {
    logger.error({ err, uid }, "Failed to parse IMAP email");
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
    logger.debug({ uid, senderEmail, subject }, "IMAP email has no PDF attachment, skipping");
    return;
  }

  logger.info(
    { uid, senderEmail, subject, attachments: pdfAttachments.length },
    "Processing IMAP email with PDF attachments",
  );

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

    logger.info(
      { emailId: emailRecord.id, storageKey, senderEmail },
      "IMAP email saved, starting auto-extraction",
    );

    // Fire-and-forget extraction
    extractAndSave(emailRecord.id, storageKey).catch((err) => {
      logger.error({ err, emailId: emailRecord.id }, "IMAP extraction error");
    });
  }
}

async function extractAndSave(emailId: number, storageKey: string): Promise<void> {
  try {
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
    logger.info({ emailId, quotationId: quotation.id }, "IMAP auto-extraction complete");
  } catch (err) {
    logger.error({ err, emailId }, "IMAP extraction failed");
    await db.update(emailsTable).set({ status: "failed" }).where(eq(emailsTable.id, emailId));
  }
}

async function pollOnce(): Promise<void> {
  const email = process.env["IMAP_EMAIL"];
  const password = process.env["IMAP_PASSWORD"];
  const host = process.env["IMAP_HOST"] || "imap.hostinger.com";
  const port = Number(process.env["IMAP_PORT"] || 993);

  if (!email || !password) {
    status.enabled = false;
    status.lastError = "IMAP_EMAIL and IMAP_PASSWORD environment variables are not set";
    return;
  }

  status.enabled = true;
  status.email = email;
  status.host = host;
  status.port = port;

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    status.connected = true;
    status.lastError = null;

    const lock = await client.getMailboxLock("INBOX");
    try {
      // Find unread emails with attachments
      const uids = await client.search({ unseen: true }, { uid: true });

      if (uids.length > 0) {
        logger.info({ count: uids.length }, "Found unread IMAP emails");

        for await (const message of client.fetch(uids, { source: true }, { uid: true })) {
          if (message.source) {
            await processEmailMessage(message.source, String(message.uid));
            // Mark as read
            await client.messageFlagsAdd(String(message.uid), ["\\Seen"], { uid: true });
          }
        }
      } else {
        logger.debug("No new IMAP emails");
      }
    } finally {
      lock.release();
    }

    status.lastCheck = new Date().toISOString();
  } catch (err) {
    status.connected = false;
    const message = err instanceof Error ? err.message : String(err);
    status.lastError = message;
    logger.error({ err }, "IMAP poll failed");
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startImapPoller(): void {
  const email = process.env["IMAP_EMAIL"];
  const password = process.env["IMAP_PASSWORD"];

  if (!email || !password) {
    logger.info("IMAP polling disabled — set IMAP_EMAIL and IMAP_PASSWORD to enable");
    status.enabled = false;
    return;
  }

  const intervalMs = Number(process.env["IMAP_POLL_INTERVAL"] || 60) * 1000;
  logger.info({ email, host: process.env["IMAP_HOST"] || "imap.hostinger.com", intervalMs }, "Starting IMAP poller");

  // Poll immediately on startup
  pollOnce().catch((err) => logger.error({ err }, "Initial IMAP poll failed"));

  pollTimer = setInterval(() => {
    pollOnce().catch((err) => logger.error({ err }, "Scheduled IMAP poll failed"));
  }, intervalMs);
}

export function stopImapPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
