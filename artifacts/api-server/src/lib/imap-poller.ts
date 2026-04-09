import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import fs from "fs";
import path from "path";
import { db, emailsTable, quotationsTable, quotationItemsTable, settingsTable } from "@workspace/db";
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

// Read a setting from DB, falling back to env var
async function getSetting(key: string, envFallback?: string): Promise<string | null> {
  const envVal = envFallback ? process.env[envFallback] : undefined;
  if (envVal) return envVal;
  try {
    const row = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    return row[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveImapConfig(email: string, password: string, host?: string, port?: number): Promise<void> {
  const pairs: [string, string][] = [
    ["imap_email", email],
    ["imap_password", password],
    ["imap_host", host || "imap.hostinger.com"],
    ["imap_port", String(port || 993)],
  ];
  for (const [key, value] of pairs) {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
  }
  // Restart poller with new credentials
  restartPoller();
}

async function getImapCredentials(): Promise<{
  email: string | null;
  password: string | null;
  host: string;
  port: number;
}> {
  const email = await getSetting("imap_email", "IMAP_EMAIL");
  const password = await getSetting("imap_password", "IMAP_PASSWORD");
  const host = (await getSetting("imap_host", "IMAP_HOST")) || "imap.hostinger.com";
  const port = Number((await getSetting("imap_port", "IMAP_PORT")) || 993);
  return { email, password, host, port };
}

async function processEmailMessage(raw: Buffer): Promise<void> {
  let parsed;
  try {
    parsed = await simpleParser(raw);
  } catch (err) {
    logger.error({ err }, "Failed to parse IMAP email");
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
    logger.debug({ senderEmail, subject }, "IMAP email has no PDF attachment, skipping");
    return;
  }

  logger.info({ senderEmail, subject, count: pdfAttachments.length }, "Processing IMAP email PDFs");

  for (const attachment of pdfAttachments) {
    const storageKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
    fs.writeFileSync(path.join(uploadDir, storageKey), attachment.content);

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

    extractAndSave(emailRecord.id, storageKey).catch((err) =>
      logger.error({ err, emailId: emailRecord.id }, "IMAP extraction error"),
    );
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
  const { email, password, host, port } = await getImapCredentials();

  if (!email || !password) {
    status.enabled = false;
    status.lastError = null;
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
      const uids = await client.search({ unseen: true }, { uid: true });

      if (uids.length > 0) {
        logger.info({ count: uids.length }, "Found unread IMAP emails");
        for await (const message of client.fetch(uids, { source: true }, { uid: true })) {
          if (message.source) {
            await processEmailMessage(message.source);
            await client.messageFlagsAdd(String(message.uid), ["\\Seen"], { uid: true });
          }
        }
      }
    } finally {
      lock.release();
    }

    status.lastCheck = new Date().toISOString();
  } catch (err) {
    status.connected = false;
    status.lastError = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "IMAP poll failed");
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

function restartPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const intervalMs = Number(process.env["IMAP_POLL_INTERVAL"] || 60) * 1000;
  // Poll immediately
  pollOnce().catch((err) => logger.error({ err }, "IMAP poll (restart) failed"));
  pollTimer = setInterval(() => {
    pollOnce().catch((err) => logger.error({ err }, "IMAP scheduled poll failed"));
  }, intervalMs);
}

export function startImapPoller(): void {
  const intervalMs = Number(process.env["IMAP_POLL_INTERVAL"] || 60) * 1000;
  logger.info({ intervalMs }, "IMAP poller starting (credentials loaded from DB or env)");

  // Initial poll — checks DB for credentials
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
