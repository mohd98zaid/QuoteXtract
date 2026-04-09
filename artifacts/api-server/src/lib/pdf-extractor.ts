import { openai } from "@workspace/integrations-openai-ai-server";
import fs from "fs";
import path from "path";

const uploadDir = "/tmp/quotation-pdfs";

export interface ExtractedQuotation {
  supplierName: string | null;
  supplierEmail: string | null;
  quotationNumber: string | null;
  quotationDate: string | null;
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

export async function extractFromPdf(storageKey: string): Promise<ExtractedQuotation> {
  const filePath = path.join(uploadDir, storageKey);

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${storageKey}`);
  }

  const pdfBuffer = fs.readFileSync(filePath);
  const base64Pdf = pdfBuffer.toString("base64");

  const systemPrompt = `You are a precise data extraction assistant. Extract structured quotation data from supplier PDF quotations. 
Always respond with valid JSON only. Do not include markdown fences or explanations.
For fields you cannot find, use null. For items, extract every line item you can identify.`;

  const userPrompt = `Extract all quotation data from this PDF document and return a JSON object with this exact structure:
{
  "supplierName": "Company name of the supplier",
  "supplierEmail": "supplier contact email or null",
  "quotationNumber": "quotation/reference number or null",
  "quotationDate": "date of quotation in ISO format or original format, or null",
  "currency": "3-letter currency code (USD, EUR, GBP, etc.) or null",
  "paymentTerms": "payment terms description or null",
  "deliveryTerms": "delivery/shipping terms or null",
  "totalAmount": "total quotation value as string with 2 decimal places, or null",
  "items": [
    {
      "partNumber": "part/item number or null",
      "description": "item description or null",
      "quantity": "quantity as string or null",
      "unitPrice": "unit price as string with 2 decimal places or null",
      "totalPrice": "line total as string with 2 decimal places or null",
      "leadTime": "lead time description or null",
      "moq": "minimum order quantity or null",
      "currency": "item-specific currency or null",
      "notes": "any additional notes for this item or null"
    }
  ],
  "extractionScore": <integer 0-100 representing confidence in extraction quality>
}

PDF content (base64 encoded):`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${base64Pdf}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  let extracted: ExtractedQuotation;
  try {
    extracted = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      extracted = JSON.parse(match[0]);
    } else {
      extracted = {
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
  }

  if (!Array.isArray(extracted.items)) {
    extracted.items = [];
  }

  return extracted;
}
