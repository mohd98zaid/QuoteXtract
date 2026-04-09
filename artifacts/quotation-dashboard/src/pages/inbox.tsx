import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
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
  Wifi,
  WifiOff,
  RefreshCw,
  Settings2,
} from "lucide-react";
import {
  useListEmails,
  useUploadPdf,
  useCreateEmail,
  useExtractQuotation,
  useListQuotations,
  useGetImapStatus,
  useGetWebhookConfig,
  useConfigureImap,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function ImapStatusPanel() {
  const [open, setOpen] = useState(true);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const { toast } = useToast();

  const {
    data: imap,
    isLoading: imapLoading,
    refetch,
    isFetching,
  } = useGetImapStatus({ query: { refetchInterval: 30_000 } });

  const { data: webhookConfig, isLoading: webhookLoading } = useGetWebhookConfig({
    query: { enabled: webhookOpen },
  });

  const configureMut = useConfigureImap();

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formPassword) return;
    try {
      await configureMut.mutateAsync({
        data: { email: formEmail, password: formPassword },
      });
      toast({ title: "Credentials saved", description: "IMAP polling is now active." });
      setFormPassword("");
      setShowChangeForm(false);
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Could not save credentials. Check your email and password." });
    }
  };

  const isConfigured = imap?.enabled;
  const isConnected = imap?.connected;

  return (
    <Card className="border border-dashed border-primary/40 bg-primary/5">
      {/* Header — always visible */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Hostinger Email Integration</p>
            <p className="text-xs text-muted-foreground">
              Auto-receive &amp; extract quotation PDFs from your inbox
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {imapLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : isConfigured && isConnected ? (
            <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs gap-1">
              <Wifi className="w-3 h-3" /> Connected
            </Badge>
          ) : isConfigured && !isConnected ? (
            <Badge variant="destructive" className="text-xs gap-1">
              <WifiOff className="w-3 h-3" /> Error
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 gap-1">
              <Settings2 className="w-3 h-3" /> Setup needed
            </Badge>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-primary/20 px-4 pb-4 pt-4 space-y-4">
          {/* ── IMAP Status ─────────────────────────────────────────── */}
          {imapLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !isConfigured || showChangeForm ? (
            /* Not yet configured OR user clicked "Change credentials" — show form */
            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your Hostinger email credentials below. The server will poll your inbox
                every 60 seconds and automatically extract any quotation PDFs.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="imap-email" className="text-xs font-medium">
                    Email address
                  </Label>
                  <Input
                    id="imap-email"
                    type="email"
                    placeholder="quotations@yourdomain.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imap-password" className="text-xs font-medium">
                    Email password
                  </Label>
                  <Input
                    id="imap-password"
                    type="password"
                    placeholder="Your email password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-background px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Server settings (pre-configured for Hostinger)
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-0.5">
                  {[
                    { label: "Host", value: "imap.hostinger.com" },
                    { label: "Port", value: "993" },
                    { label: "Encryption", value: "SSL" },
                  ].map(({ label, value }) => (
                    <span key={label} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{label}:</span> {value}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={configureMut.isPending || !formEmail || !formPassword}
                className="gap-1.5"
              >
                {configureMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wifi className="w-3.5 h-3.5" />
                )}
                {configureMut.isPending ? "Connecting..." : "Save & Connect"}
              </Button>
            </form>
          ) : (
            /* Configured — show live status */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatusTile
                  label="Status"
                  value={isConnected ? "Connected" : "Error"}
                  icon={
                    isConnected ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-500" />
                    )
                  }
                  valueClass={isConnected ? "text-green-600" : "text-red-600"}
                />
                <StatusTile
                  label="Account"
                  value={imap.email || "—"}
                  icon={<Mail className="w-4 h-4 text-muted-foreground" />}
                  mono
                  truncate
                />
                <StatusTile
                  label="Server"
                  value={`${imap.host}:${imap.port}`}
                  icon={<Settings2 className="w-4 h-4 text-muted-foreground" />}
                  mono
                />
                <StatusTile
                  label="Poll interval"
                  value={`${imap.pollIntervalSeconds}s`}
                  icon={<RefreshCw className="w-4 h-4 text-muted-foreground" />}
                />
              </div>

              {imap.lastCheck && (
                <p className="text-xs text-muted-foreground">
                  Last checked:{" "}
                  <span className="font-medium text-foreground">
                    {formatDistanceToNow(new Date(imap.lastCheck), { addSuffix: true })}
                  </span>{" "}
                  &nbsp;·&nbsp; {format(new Date(imap.lastCheck), "HH:mm:ss")}
                </p>
              )}

              {imap.lastError && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{imap.lastError}</span>
                </div>
              )}

              {isConnected && (
                <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-800 dark:text-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Polling active — any new email with a PDF attachment will be automatically
                    extracted and appear in your inbox below.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => {
                    setFormEmail(imap?.email || "");
                    setFormPassword("");
                    setShowChangeForm(true);
                  }}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Change credentials
                </Button>
              </div>
            </div>
          )}

          {/* ── Webhook alternative (collapsible) ─────────────────── */}
          <div className="border-t border-primary/15 pt-3">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setWebhookOpen((v) => !v)}
            >
              <Webhook className="w-3.5 h-3.5" />
              Alternative: use a webhook endpoint instead
              {webhookOpen ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              )}
              <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary/30 text-primary ml-1">
                <Zap className="w-2.5 h-2.5 mr-0.5" /> Phase 2
              </Badge>
            </button>

            {webhookOpen && (
              <div className="mt-3 space-y-3">
                {webhookLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : webhookConfig ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      If you prefer push-based delivery, configure Hostinger to pipe raw emails to
                      this URL instead of using IMAP polling.
                    </p>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Hostinger Pipe URL
                      </p>
                      <div className="flex items-center gap-1.5 rounded-md bg-background border px-3 py-2">
                        <code className="text-xs text-foreground flex-1 truncate font-mono">
                          {webhookConfig.rawEmailUrl}
                        </code>
                        <CopyButton text={webhookConfig.rawEmailUrl} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Mailgun / SendGrid URL
                      </p>
                      <div className="flex items-center gap-1.5 rounded-md bg-background border px-3 py-2">
                        <code className="text-xs text-foreground flex-1 truncate font-mono">
                          {webhookConfig.multipartUrl}
                        </code>
                        <CopyButton text={webhookConfig.multipartUrl} />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function StatusTile({
  label,
  value,
  icon,
  valueClass = "",
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="rounded-lg bg-background border px-3 py-2 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <span
        className={`text-xs font-medium ${valueClass} ${mono ? "font-mono" : ""} ${truncate ? "truncate" : ""}`}
      >
        {value}
      </span>
    </div>
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
      toast({ variant: "destructive", title: "Invalid file type", description: "Please upload a PDF file." });
      return;
    }
    try {
      setIsUploading(true);
      setUploadProgress("Uploading PDF...");
      const uploadRes = await uploadPdfMut.mutateAsync({ data: { file } });
      setUploadProgress("Creating record...");
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
        data: { emailId: emailRes.id, pdfStorageKey: uploadRes.storageKey },
      });
      toast({ title: "Extraction complete", description: "Successfully processed the quotation." });
      setLocation(`/quotations/${quotationRes.id}`);
    } catch {
      toast({ variant: "destructive", title: "Processing failed", description: "An error occurred while processing the PDF." });
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "extracted":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
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
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
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
    const isEmail = email.senderEmail && !email.subject?.startsWith("Uploaded:");
    return isEmail ? (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-300 text-violet-600">
        <Mail className="w-2.5 h-2.5 mr-0.5" /> Email
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-500">
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

      <ImapStatusPanel />

      <Card
        className={`border-2 border-dashed transition-all duration-200 ease-in-out ${
          isDragging ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/50 hover:bg-muted/50"
        } ${isUploading ? "pointer-events-none opacity-80" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
            {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <UploadCloud className="w-7 h-7" />}
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {isUploading ? uploadProgress : "Or upload a PDF manually"}
          </h3>
          {!isUploading && (
            <>
              <p className="text-sm text-muted-foreground mb-5 max-w-md">
                Drag and drop or select a PDF — AI will extract all customer and pricing details.
              </p>
              <Button onClick={() => document.getElementById("pdf-upload")?.click()}>
                Select File
              </Button>
              <input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={handleFileInput} />
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
                        {email.receivedAt ? format(new Date(email.receivedAt), "MMM d, yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="text-right">
                        {email.status === "extracted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setLocation(quotationId ? `/quotations/${quotationId}` : "/quotations")}
                          >
                            View Details <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                        {email.status === "processing" && (
                          <span className="text-xs text-muted-foreground italic">Extracting...</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    No documents yet. Configure email integration above or upload a PDF manually.
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
