import { openai } from "@workspace/integrations-local-ai-server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const uploadDir = "/tmp/quotation-pdfs";

const MODEL = process.env.LOCAL_AI_MODEL ?? "gpt-4o";

export interface ExtractedQuotation {
  isQuotation: boolean;
  supplierName: string | null;
  supplierEmail: string | null;
  quotationNumber: string | null;
  quotationDate: string | null;
  clientAddress?: string | null;
  clientContact?: string | null;
  clientVat?: string | null;
  currency: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  totalAmount: string | null;
  items: ExtractedItem[];
  extractionScore: number;
}

export interface ExtractedItem {
  partNumber: string | null;
  description: string | null;
  quantity: string | null;
  unitPrice: string | null;
  totalPrice: string | null;
  leadTime: string | null;
  moq: string | null;
  currency: string | null;
  notes: string | null;
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", filePath, "-"], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function extractFromPdf(storageKey: string): Promise<ExtractedQuotation> {
  const filePath = path.join(uploadDir, storageKey);

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${storageKey}`);
  }

  const pdfText = await extractTextFromPdf(filePath);
  
  // DEBUG: Check what was actually extracted
  console.log(`[DEBUG] PDF Extracted Text length: ${pdfText.length}`);
  console.log(`[DEBUG] PDF Extracted Text (first 500 chars): "${pdfText.slice(0, 500)}"`);

  // Truncate PDF text so a small local model won't OOM or loop
  const truncatedText = pdfText.slice(0, 3000) || "(No text extracted — may be scanned image. Use extractionScore: 0.)";

  const systemPrompt = `You are a precise data extraction AI that extracts structured data from quotation/invoice PDF documents.

CRITICAL DOCUMENT STRUCTURE RULES:
1. Every quotation has TWO parties:
   - ISSUER/SENDER: The company that CREATED and SENT the document. They appear at the top of the document in the header/letterhead. Do NOT extract them as the customer.
   - CUSTOMER/RECIPIENT: The company RECEIVING the quote. They appear under labels like 'Customer Details', 'To:', 'Attention:', 'Billed To:', 'Ship To:', etc.
2. Our company 'PLUMS AND PEARLS FZE LLC' is ALWAYS the issuer. If you see this name, it is the sender — NEVER the customer.
3. The TRN '104330330200003' belongs to PLUMS AND PEARLS FZE LLC (issuer). NEVER assign it to the customer.
4. Extract only the CUSTOMER's name, address, contact, and VAT number — NOT the issuer's.
5. For system-generated PDFs: look specifically under the 'Customer Details' section heading for the customer's information.

Return ONLY a raw JSON object. No markdown, no explanation.`;

  const userPrompt = `Extract the following information from the quotation document below. Return a JSON object.

IMPORTANT:
- "supplierName" = the NAME OF THE CUSTOMER (the company receiving this quotation, NOT the company that issued it)
- The issuer/sender appears in the header/top of the document — DO NOT use them as the customer
- Look for 'Customer Details', 'To:', 'Attention' sections to find the true customer

JSON Schema:
{
  "supplierName": "string | null — The CUSTOMER company name (recipient of quote, NOT the issuer at the top)",
  "clientAddress": "string | null — The customer's address",
  "clientContact": "string | null — The customer's phone or contact number",
  "clientVat": "string | null — The customer's VAT/TRN number (NOT 104330330200003 which belongs to the issuer)",
  "supplierEmail": "string | null — The customer's email",
  "quotationNumber": "string | null — The document/quotation reference number",
  "quotationDate": "string | null — Document date in YYYY-MM-DD format",
  "currency": "string | null",
  "paymentTerms": "string | null",
  "deliveryTerms": "string | null",
  "totalAmount": "string | null — The grand total amount as a plain number string",
  "items": [
    {
      "partNumber": "string | null",
      "description": "string | null",
      "quantity": "string | null",
      "unitPrice": "string | null",
      "totalPrice": "string | null",
      "leadTime": "string | null",
      "moq": "string | null",
      "currency": "string | null",
      "notes": "string | null"
    }
  ],
  "extractionScore": "number (0-100 confidence)"
}

DOCUMENT TEXT:
${truncatedText}

JSON:`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  let extracted: ExtractedQuotation;
  try {
    extracted = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        extracted = JSON.parse(match[0]);
      } catch {
        extracted = emptyExtraction();
      }
    } else {
      extracted = emptyExtraction();
    }
  }

  if (!Array.isArray(extracted.items)) {
    extracted.items = [];
  }

  if (typeof extracted.extractionScore !== "number") {
    extracted.extractionScore = 50;
  }

  // Determine if this is a quotation based on whether anything useful was extracted
  const hasItems = extracted.items && extracted.items.length > 0;

  const hasRef = !!extracted.quotationNumber || !!extracted.supplierName || !!extracted.totalAmount;
  
  if (!hasItems && !hasRef) {
    extracted.isQuotation = false;
  } else {
    extracted.isQuotation = true;
  }

  return extracted;
}

function emptyExtraction(): ExtractedQuotation {
  return {
    isQuotation: false,
    supplierName: null,
    supplierEmail: null,
    quotationNumber: null,
    quotationDate: null,
    currency: null,
    paymentTerms: null,
    deliveryTerms: null,
    totalAmount: null,
    items: [],
    extractionScore: 0,
  };
}
