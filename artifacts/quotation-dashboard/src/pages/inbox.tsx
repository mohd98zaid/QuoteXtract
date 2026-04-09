import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  UploadCloud,
  File,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
  Webhook,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Zap,
  Mail,
} from "lucide-react";
import {
  useListEmails,
  useUploadPdf,
  useCreateEmail,
  useExtractQuotation,
  useListQuotations,
  useGetWebhookConfig,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function WebhookSetupPanel() {
  const [open, setOpen] = useState(false);
  const { data: config, isLoading } = useGetWebhookConfig({ query: { enabled: open } });

  return (
    <Card className="border border-dashed border-primary/40 bg-primary/5">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Hostinger Email Integration</p>
            <p className="text-xs text-muted-foreground">
              Auto-receive quotations via email — no manual upload needed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            <Zap className="w-3 h-3 mr-1" /> Phase 2
          </Badge>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-primary/20 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : config ? (
            <>
              <p className="text-sm text-muted-foreground">
                Configure Hostinger to forward supplier emails with PDF attachments to this URL.
                Quotations are automatically extracted by AI and appear in your inbox.
              </p>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Hostinger Pipe URL (Raw Email)
                  </p>
                  <div className="flex items-center gap-1.5 rounded-md bg-background border px-3 py-2">
                    <code className="text-xs text-foreground flex-1 truncate font-mono">
                      {config.rawEmailUrl}
                    </code>
                    <CopyButton text={config.rawEmailUrl} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Mailgun / SendGrid URL (Multipart Form)
                  </p>
                  <div className="flex items-center gap-1.5 rounded-md bg-background border px-3 py-2">
                    <code className="text-xs text-foreground flex-1 truncate font-mono">
                      {config.multipartUrl}
                    </code>
                    <CopyButton text={config.multipartUrl} />
                  </div>
                </div>

                {config.secretRequired && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Webhook secret is enabled. Append <code className="font-mono">?secret=YOUR_WEBHOOK_SECRET</code> to the URL.
                    </span>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Hostinger Setup Steps
                  </p>
                  <ol className="space-y-1.5">
                    {config.hostingerSetup.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step.replace(/^\d+\.\s*/, "")}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
                  <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Supported formats: raw RFC 822 (Hostinger cPanel pipe) and multipart form
                    (Mailgun / SendGrid Inbound Parse). Both trigger automatic AI extraction.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Failed to load webhook configuration. Make sure the API server is running.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Inbox() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const { data: emails, isLoading } = useListEmails();
  const { data: allQuotations } = useListQuotations({});

  const emailToQuotationId = useMemo(() => {
    const map: Record<number, number> = {};
    if (allQuotations) {
      for (const q of allQuotations) {
        if (q.emailId) map[q.emailId] = q.id;
      }
    }
    return map;
  }, [allQuotations]);

  const uploadPdfMut = useUploadPdf();
  const createEmailMut = useCreateEmail();
  const extractMut = useExtractQuotation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF file.",
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress("Uploading PDF...");

      const uploadRes = await uploadPdfMut.mutateAsync({ data: { file } });

      setUploadProgress("Creating email record...");

      const emailRes = await createEmailMut.mutateAsync({
        data: {
          subject: `Uploaded: ${file.name}`,
          pdfFilename: uploadRes.filename,
          pdfStorageKey: uploadRes.storageKey,
          receivedAt: new Date().toISOString(),
        },
      });

      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });

      setUploadProgress("Extracting data via AI...");

      const quotationRes = await extractMut.mutateAsync({
        data: {
          emailId: emailRes.id,
          pdfStorageKey: uploadRes.storageKey,
        },
      });

      toast({
        title: "Extraction complete",
        description: "Successfully processed the quotation.",
      });

      setLocation(`/quotations/${quotationRes.id}`);
    } catch (error) {
      console.error("Upload process failed:", error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "An error occurred while processing the PDF.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "extracted":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Extracted
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" /> Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        );
    }
  };

  const getSourceBadge = (email: { senderEmail?: string | null; subject?: string | null }) => {
    const isWebhook = email.senderEmail && !email.subject?.startsWith("Uploaded:");
    if (isWebhook) {
      return (
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-violet-300 text-violet-600">
          <Webhook className="w-2.5 h-2.5 mr-0.5" /> Email
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] px-1 py-0 border-slate-300 text-slate-500">
        <UploadCloud className="w-2.5 h-2.5 mr-0.5" /> Upload
      </Badge>
    );
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Inbox</h1>
        <p className="text-muted-foreground">Upload PDFs or receive quotations by email automatically.</p>
      </div>

      <WebhookSetupPanel />

      <Card
        className={`border-2 border-dashed transition-all duration-200 ease-in-out ${
          isDragging
            ? "border-primary bg-primary/5 shadow-md"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        } ${isUploading ? "pointer-events-none opacity-80" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <h3 className="text-xl font-semibold mb-2">
            {isUploading ? uploadProgress : "Drop your quotation PDF here"}
          </h3>

          {!isUploading && (
            <>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                The AI will automatically extract supplier details, items, pricing, and terms.
              </p>

              <div className="flex items-center gap-4">
                <Button
                  onClick={() => document.getElementById("pdf-upload")?.click()}
                  className="relative"
                >
                  Select File
                </Button>
                <input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="p-6 pb-2">
          <h2 className="text-xl font-semibold">Processed Documents</h2>
        </div>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>File / Subject</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : emails && emails.length > 0 ? (
                emails.map((email) => {
                  const quotationId = emailToQuotationId[email.id];
                  return (
                    <TableRow key={email.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[220px]">
                            {email.pdfFilename || email.subject || "Untitled"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getSourceBadge(email)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.senderName || email.senderEmail || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {email.receivedAt
                          ? format(new Date(email.receivedAt), "MMM d, yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="text-right">
                        {email.status === "extracted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              if (quotationId) {
                                setLocation(`/quotations/${quotationId}`);
                              } else {
                                setLocation("/quotations");
                              }
                            }}
                          >
                            View Details <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                        {email.status === "processing" && (
                          <span className="text-xs text-muted-foreground italic">
                            Extracting...
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    No documents found. Upload a PDF or configure email integration to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
