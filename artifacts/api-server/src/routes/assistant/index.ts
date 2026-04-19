import { Router, type IRouter } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-local-ai-server";
import { db, quotationsTable, quotationItemsTable, mailAccountsTable, emailsTable, settingsTable } from "@workspace/db";
import { eq, ilike, or, count } from "drizzle-orm";

const router: IRouter = Router();

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema),
});

const MODEL = process.env.LOCAL_AI_MODEL ?? "gpt-4o";

// Tools definition
const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_quotations",
      description: "Search for quotations by supplier name or quotation number.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The name of the supplier/customer or the quotation number to search for.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_quotation_items",
      description: "Get the line items and details for a specific quotation by its ID.",
      parameters: {
        type: "object",
        properties: {
          quotationId: {
            type: "number",
            description: "The unique ID of the quotation.",
          },
        },
        required: ["quotationId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_mail_accounts",
      description: "List all connected email accounts and their connection details (excluding passwords).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_system_status",
      description: "Get a summary of system activity, including total emails processed and quotation counts.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_system_settings",
      description: "Retrieve general system-wide configuration settings.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function handleToolCall(toolCall: any) {
  const args = JSON.parse(toolCall.function.arguments);

  if (toolCall.function.name === "search_quotations") {
    const { query } = args;
    const results = await db
      .select({
        id: quotationsTable.id,
        supplierName: quotationsTable.supplierName,
        quotationNumber: quotationsTable.quotationNumber,
        totalAmount: quotationsTable.totalAmount,
        currency: quotationsTable.currency,
        status: quotationsTable.status,
      })
      .from(quotationsTable)
      .where(
        or(
          ilike(quotationsTable.supplierName, `%${query}%`),
          ilike(quotationsTable.quotationNumber, `%${query}%`)
        )
      )
      .limit(5);

    return JSON.stringify(results);
  }

  if (toolCall.function.name === "get_quotation_items") {
    const { quotationId } = args;
    const items = await db
      .select()
      .from(quotationItemsTable)
      .where(eq(quotationItemsTable.quotationId, quotationId));
    
    // Also get the parent quotation context
    const [quote] = await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, quotationId));

    return JSON.stringify({
      quotation: quote ? {
        id: quote.id,
        supplierName: quote.supplierName,
        totalAmount: quote.totalAmount,
        currency: quote.currency
      } : null,
      items: items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }))
    });
  }

  if (toolCall.function.name === "get_mail_accounts") {
    const accounts = await db
      .select({
        id: mailAccountsTable.id,
        label: mailAccountsTable.label,
        email: mailAccountsTable.email,
        imapHost: mailAccountsTable.imapHost,
        smtpHost: mailAccountsTable.smtpHost,
        isActive: mailAccountsTable.isActive,
      })
      .from(mailAccountsTable);
    return JSON.stringify(accounts);
  }

  if (toolCall.function.name === "get_system_status") {
    const [emailStats] = await db.select({ total: count() }).from(emailsTable);
    const [quoteStats] = await db.select({ total: count() }).from(quotationsTable);
    
    // Get breakdown by status
    const statusBreakdown = await db
      .select({ status: emailsTable.status, count: count() })
      .from(emailsTable)
      .groupBy(emailsTable.status);

    return JSON.stringify({
      totalEmails: Number(emailStats.total),
      totalQuotations: Number(quoteStats.total),
      emailStatusBreakdown: statusBreakdown.map(s => ({ status: s.status, count: Number(s.count) }))
    });
  }

  if (toolCall.function.name === "get_system_settings") {
    const settings = await db.select().from(settingsTable);
    return JSON.stringify(settings);
  }

  return JSON.stringify({ error: "Unknown tool" });
}

router.post("/chat", async (req, res): Promise<void> => {
  try {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues, code: "VALIDATION_ERROR" });
      return;
    }

    const { messages } = parsed.data;

    // Prepend a system prompt
    const systemPrompt = {
      role: "system" as const,
      content: `You are QuoteXtract Total System Assistant. You have full access to view (but not modify) the system's configuration, email status, and quotation data.
CRITICAL INSTRUCTION: If the user provides a name (e.g. "IAN", "Apple", "John"), a single word, or asks to search for something, you MUST immediately call the "search_quotations" tool with that query.
Use the provided tools to answer ANY system-related queries:
- For status/counts: Use "get_system_status".
- For mail account settings: Use "get_mail_accounts".
- For general configuration: Use "get_system_settings".
- For quotation details: Use "search_quotations" and "get_quotation_items".

Always format data clearly. Use Markdown tables for lists.
When presenting a specific quotation, always provide a clickable link: [View Details](/quotations/{id}).
If the user asks about system health, mention the number of processed vs failed emails.
Keep answers professional, concise, and helpful.`,
    };

    const thread = [systemPrompt, ...messages];

    let response = await openai.chat.completions.create({
      model: MODEL,
      messages: thread,
      tools: tools,
      tool_choice: "auto",
    });

    let message = response.choices[0].message;

    // Handle tool calls iteratively (allows agent to use multiple tools in turn)
    let iterations = 0;
    while (message.tool_calls && iterations < 5) {
      // Create a response message containing the tool calls we received
      thread.push(message as any);

      // Execute each tool and append the results as tool messages
      for (const toolCall of message.tool_calls) {
        let toolResultStr;
        try {
          toolResultStr = await handleToolCall(toolCall);
        } catch (e) {
          toolResultStr = JSON.stringify({ error: "Failed to execute tool" });
        }
        
        thread.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: (toolCall as any).function.name,
          content: toolResultStr,
        } as any);
      }

      // Send the results back to the model
      response = await openai.chat.completions.create({
        model: MODEL,
        messages: thread,
        tools: tools,
        tool_choice: "auto",
      });

      message = response.choices[0].message;
      iterations++;
    }

    res.json({ message });
  } catch (err: any) {
    req.log.error(err, "Assistant chat error");
    res.status(500).json({ error: "Failed to process chat" });
  }
});

export default router;
