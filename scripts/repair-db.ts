import { db, emailsTable, mailAccountsTable } from '../lib/db/src/index';
import { isNull, eq } from 'drizzle-orm';

async function repair() {
  console.log('--- Starting Database Repair ---');
  
  const accounts = await db.select().from(mailAccountsTable);
  if (accounts.length === 0) {
    console.error('No mail accounts found. Please add an account first.');
    return;
  }
  
  const defaultAccountId = accounts[0].id;
  console.log(`Using default account ID: ${defaultAccountId} (${accounts[0].email})`);
  
  // 1. Fix orphaned emails
  const orphaned = await db.select().from(emailsTable).where(isNull(emailsTable.accountId));
  console.log(`Found ${orphaned.length} orphaned emails. fixing...`);
  
  if (orphaned.length > 0) {
    await db.update(emailsTable)
      .set({ accountId: defaultAccountId })
      .where(isNull(emailsTable.accountId));
    console.log('Fixed orphaned emails.');
  }
  
  // 2. Fix missing source
  await db.update(emailsTable)
    .set({ source: 'imap' })
    .where(isNull(emailsTable.source));
  
  // 3. Heuristic for missing PDFs
  const missingPdfs = await db.select().from(emailsTable).where(isNull(emailsTable.pdfFilename));
  console.log(`Checking ${missingPdfs.length} emails for hidden PDFs...`);
  
  let fixedPdfs = 0;
  for (const email of missingPdfs) {
    if (email.bodyText && email.bodyText.toLowerCase().includes('.pdf')) {
      // Basic heuristic: find filename between < and >
      const match = email.bodyText.match(/<([^>]+\.pdf)>/i);
      if (match) {
        console.log(`  Linking PDF heuristic for mail ${email.id}: ${match[1]}`);
        await db.update(emailsTable)
          .set({ pdfFilename: match[1], status: 'pending' })
          .where(eq(emailsTable.id, email.id));
        fixedPdfs++;
      }
    }
  }
  console.log(`Fixed ${fixedPdfs} PDF metadata entries.`);
  console.log('--- Repair Complete ---');
}

repair().catch(console.error);
