import "dotenv/config";
import fs from "fs";
import path from "path";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { eq } from "drizzle-orm";
import { db, emailsTable, mailAccountsTable, type MailAccount } from "@workspace/db";
import { logger } from "./logger";

const uploadDir = "/tmp/quotation-pdfs";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Map of account ID to active connection status
const accountStatuses = new Map<number, {
  connected: boolean;
  lastCheck: string | null;
  lastError: string | null;
  timer: ReturnType<typeof setInterval> | null;
}>();

export function getImapStatusForAccount(accountId: number) {
  return accountStatuses.get(accountId) || {
    connected: false,
    lastCheck: null,
    lastError: null,
    timer: null,
  };
}

export async function pollAccount(account: MailAccount): Promise<number> {
  const status = getImapStatusForAccount(account.id);
  accountStatuses.set(account.id, status);

  if (!account.isActive) {
    return 0;
  }

  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.secure,
    auth: { user: account.email, pass: account.password },
    logger: false,
  });

  try {
    await client.connect();
    status.connected = true;
    status.lastError = null;

    const lock = await client.getMailboxLock("INBOX");
    let fetched = 0;
    try {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const searchResult = await client.search({ since }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length > 0) {
        logger.info({ count: uids.length, account: account.email }, "Fetching recent IMAP emails");

        for await (const message of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
          if (!message.source) continue;

          let parsed;
          try {
            parsed = await simpleParser(message.source);
          } catch (err) {
            continue;
          }

          const msgId = (parsed.messageId || null) as string | null;

          if (msgId) {
            const existing = await db
              .select({ id: emailsTable.id, pdfStorageKey: emailsTable.pdfStorageKey })
              .from(emailsTable)
              .where(eq(emailsTable.messageId, msgId))
              .limit(1);
            if (existing.length > 0) {
              const record = existing[0];
              if (record.pdfStorageKey && !fs.existsSync(path.join(uploadDir, record.pdfStorageKey))) {
                const pdfAtts = (parsed.attachments || []).filter(
                  (a) => a.contentType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf")
                );
                if (pdfAtts.length > 0) {
                  fs.writeFileSync(path.join(uploadDir, record.pdfStorageKey), pdfAtts[0].content);
                }
              }
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
              a.contentType === "application/pdf" ||
              a.filename?.toLowerCase().endsWith(".pdf") ||
              (a.contentDisposition === "attachment" && a.filename?.toLowerCase().endsWith(".pdf"))
          );

          if (pdfAttachments.length > 0) {
            for (const attachment of pdfAttachments) {
              const storageKey = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
              fs.writeFileSync(path.join(uploadDir, storageKey), attachment.content);

              await db.insert(emailsTable).values({
                accountId: account.id,
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
            await db.insert(emailsTable).values({
              accountId: account.id,
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
        }
      }
    } finally {
      lock.release();
    }

    status.lastCheck = new Date().toISOString();
    return fetched;
  } catch (err) {
    status.connected = false;
    status.lastError = err instanceof Error ? err.message : String(err);
    logger.error({ err, account: account.email }, "IMAP poll failed");
    return 0;
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

export async function stopAllPollers(): Promise<void> {
  for (const [id, status] of accountStatuses.entries()) {
    if (status.timer) {
      clearInterval(status.timer);
      status.timer = null;
    }
  }
}

export async function startImapPoller(): Promise<void> {
  await stopAllPollers();
  
  try {
    const accounts = await db.select().from(mailAccountsTable).where(eq(mailAccountsTable.isActive, true));
    
    for (const account of accounts) {
      // Run once immediately
      pollAccount(account).catch((err) => logger.error({ err }, "Initial poll failed"));
      
      // Schedule polling (every 60s)
      const timer = setInterval(() => {
        pollAccount(account).catch((err) => logger.error({ err }, "Interval poll failed"));
      }, 60 * 1000);
      
      const status = getImapStatusForAccount(account.id);
      status.timer = timer;
    }
    
    logger.info(`Started IMAP pollers for ${accounts.length} active accounts`);
  } catch (err) {
    logger.error({ err }, "Failed to load mail accounts for polling");
  }
}

export async function restartPoller(): Promise<void> {
  await startImapPoller();
}

export async function runScan(): Promise<{ connected: boolean; fetched: number; error: string | null }> {
  try {
    const accounts = await db.select().from(mailAccountsTable).where(eq(mailAccountsTable.isActive, true));
    if (accounts.length === 0) {
      return { connected: false, fetched: 0, error: "No active mail accounts found. Please add one in Settings." };
    }
    
    const fetchedResults = await Promise.all(accounts.map(a => pollAccount(a)));
    const totalFetched = fetchedResults.reduce((sum, count) => sum + count, 0);
    
    // Check if at least one account connected successfully
    const statuses = accounts.map(a => getImapStatusForAccount(a.id));
    const anyConnected = statuses.some(s => s.connected);
    const lastError = statuses.find(s => !s.connected && s.lastError)?.lastError || null;

    return {
      connected: anyConnected,
      fetched: totalFetched,
      error: anyConnected ? null : (lastError || "Check your credentials"),
    };
  } catch (err) {
    logger.error({ err }, "Manual scan failed");
    return { connected: false, fetched: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// We also have restorePdfFromImap in the old file. We need to implement it here.
export async function restorePdfFromImap(messageId: string, pdfStorageKey: string): Promise<boolean> {
  // Try to find the email record to get accountId
  const existing = await db
    .select({ accountId: emailsTable.accountId })
    .from(emailsTable)
    .where(eq(emailsTable.messageId, messageId))
    .limit(1);
    
  if (existing.length === 0 || !existing[0].accountId) return false;
  
  const accountRows = await db
    .select()
    .from(mailAccountsTable)
    .where(eq(mailAccountsTable.id, existing[0].accountId))
    .limit(1);
    
  if (accountRows.length === 0) return false;
  const account = accountRows[0];
  
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.secure,
    auth: { user: account.email, pass: account.password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchResult = await client.search({ header: { messageId } }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      if (uids.length > 0) {
        for await (const message of client.fetch(uids, { source: true })) {
          if (!message.source) continue;
          const parsed = await simpleParser(message.source);
          const pdfAtts = (parsed.attachments || []).filter(
            (a) => a.contentType === "application/pdf" || a.filename?.toLowerCase().endsWith(".pdf")
          );
          if (pdfAtts.length > 0) {
            fs.writeFileSync(path.join(uploadDir, pdfStorageKey), pdfAtts[0].content);
            return true;
          }
        }
      }
    } finally {
      lock.release();
    }
    return false;
  } catch (err) {
    logger.error({ err }, "IMAP restore failed");
    return false;
  } finally {
    try { await client.logout(); } catch { }
  }
}
