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

  // Truncate PDF text so a small local model won't OOM or loop
  const truncatedText = pdfText.slice(0, 3000) || "(No text extracted — may be scanned image. Use extractionScore: 0.)";

  const systemPrompt = `You are a data extraction AI. You extract structured data from documents into a JSON object. No markdown, no explanations. 
CRITICAL RULE: The TRN '104330330200003' and the company 'PLUMS AND PEARLS FZE LLC' belong to the issuer/supplier, NOT the customer. You must NEVER extract '104330330200003' as the customer VAT or clientVat. Find the specific customer's VAT/TRN. If the document has no other TRN for the customer, set clientVat to null.`;

  const userPrompt = `Extract information from the document text below into a JSON object. Use null if a field is not found.

JSON Schema format to follow:
{
  "supplierName": "string | null (Name of the customer receiving the quote)",
  "clientAddress": "string | null",
  "clientContact": "string | null",
  "clientVat": "string | null",
  "supplierEmail": "string | null",
  "quotationNumber": "string | null",
  "quotationDate": "string | null (YYYY-MM-DD)",
  "currency": "string | null",
  "paymentTerms": "string | null",
  "deliveryTerms": "string | null",
  "totalAmount": "string | null",
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
  "extractionScore": "number (0-100)"
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
