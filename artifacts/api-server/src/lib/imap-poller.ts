import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import fs from "fs";
import path from "path";
import { db, emailsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

export async function saveImapConfig(
  email: string,
  password: string,
  host?: string,
  port?: number,
): Promise<void> {
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
    let fetched = 0;
    try {
      const uids = await client.search({ unseen: true }, { uid: true });

      if (uids.length > 0) {
        logger.info({ count: uids.length }, "Fetching unread IMAP emails");

        for await (const message of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
          if (!message.source) continue;

          let parsed;
          try {
            parsed = await simpleParser(message.source);
          } catch (err) {
            logger.error({ err, uid: message.uid }, "Failed to parse email");
            continue;
          }

          const msgId = (parsed.messageId || null) as string | null;

          // Skip duplicate (already imported by messageId)
          if (msgId) {
            const existing = await db
              .select({ id: emailsTable.id })
              .from(emailsTable)
              .where(eq(emailsTable.messageId, msgId))
              .limit(1);
            if (existing.length > 0) {
              await client.messageFlagsAdd(String(message.uid), ["\\Seen"], { uid: true });
              continue;
            }
          }

          const senderName = parsed.from?.value[0]?.name || null;
          const senderEmail = parsed.from?.value[0]?.address || null;
          const subject = parsed.subject || null;
          const receivedAt = parsed.date?.toISOString() || new Date().toISOString();
          const bodyText = parsed.text || null;
          const bodyHtml = parsed.html || null;

          const pdfAttachments = (parsed.attachments || []).filter(
            (a) =>
              a.contentType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf"),
          );

          if (pdfAttachments.length > 0) {
            // Create one email record per PDF attachment
            for (const attachment of pdfAttachments) {
              const storageKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
              fs.writeFileSync(path.join(uploadDir, storageKey), attachment.content);

              await db.insert(emailsTable).values({
                senderName,
                senderEmail,
                subject,
                receivedAt,
                bodyText,
                bodyHtml,
                messageId: msgId,
                source: "imap",
                pdfFilename: attachment.filename || "attachment.pdf",
                pdfStorageKey: storageKey,
                isRead: false,
                status: "pending",
              });
              fetched++;
            }
          } else {
            // Email without PDF — store for reading, no PDF tracking
            await db.insert(emailsTable).values({
              senderName,
              senderEmail,
              subject,
              receivedAt,
              bodyText,
              bodyHtml,
              messageId: msgId,
              source: "imap",
              pdfFilename: null,
              pdfStorageKey: null,
              isRead: false,
              status: "pending",
            });
            fetched++;
          }

          // Mark as seen in IMAP so we don't re-fetch
          await client.messageFlagsAdd(String(message.uid), ["\\Seen"], { uid: true });
        }

        if (fetched > 0) logger.info({ fetched }, "IMAP emails stored (pending manual tracking)");
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
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

function restartPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const intervalMs = Number(process.env["IMAP_POLL_INTERVAL"] || 60) * 1000;
  pollOnce().catch((err) => logger.error({ err }, "IMAP poll (restart) failed"));
  pollTimer = setInterval(() => {
    pollOnce().catch((err) => logger.error({ err }, "IMAP scheduled poll failed"));
  }, intervalMs);
}

export function startImapPoller(): void {
  const intervalMs = Number(process.env["IMAP_POLL_INTERVAL"] || 60) * 1000;
  logger.info({ intervalMs }, "IMAP poller starting");
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
