import { useState } from "react";
import { useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  Mail,
  Paperclip,
  BarChart2,
  ArrowRight,
  Loader2,
  CheckCircle2,
  RefreshCw,
  User,
  Clock,
  FileText,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import {
  useListMail,
  useGetMail,
  useTrackMailPdf,
  getListMailQueryKey,
  getGetMailQueryKey,
  type MailItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function unreadCount(mails: MailItem[] | undefined) {
  return (mails || []).filter((m) => !m.isRead).length;
}

function senderInitials(mail: MailItem) {
  const name = mail.senderName || mail.senderEmail || "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function StatusChip({ status }: { status: string }) {
  if (status === "extracted")
    return (
      <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] px-1.5 py-0 h-4">
        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Tracked
      </Badge>
    );
  if (status === "processing")
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0 h-4">
        <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> Extracting
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
        <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Failed
      </Badge>
    );
  return null;
}

export default function MailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: mails, isLoading: mailsLoading, refetch, isFetching } = useListMail({
    query: { refetchInterval: 30_000 },
  });

  const { data: detail, isLoading: detailLoading } = useGetMail(selectedId ?? 0, {
    query: {
      enabled: selectedId !== null,
      onSuccess: () => {
        // Invalidate list so unread count updates
        queryClient.invalidateQueries({ queryKey: getListMailQueryKey() });
      },
    },
  });

  const trackMut = useTrackMailPdf();

  const handleTrack = async (mailId: number) => {
    try {
      const result = await trackMut.mutateAsync({ id: mailId });
      if (result.alreadyTracked) {
        toast({ title: "Already tracked", description: "This PDF is already in your quotations." });
      } else {
        toast({ title: "PDF tracked!", description: "Quotation created and added to your dashboard." });
        queryClient.invalidateQueries({ queryKey: getListMailQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMailQueryKey(mailId) });
      }
      setLocation(`/quotations/${result.quotationId}`);
    } catch {
      toast({ variant: "destructive", title: "Tracking failed", description: "Could not extract the PDF. Try again." });
    }
  };

  const unread = unreadCount(mails);

  return (
    <div className="flex flex-col h-full -m-4 md:-m-8">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">Mail</h1>
          {unread > 0 && (
            <Badge className="bg-primary text-primary-foreground h-5 px-1.5 text-[10px]">
              {unread} new
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Left panel: email list ─────────────────────────────────── */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {mailsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !mails || mails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 px-6 text-center gap-2">
                <Mail className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No emails yet</p>
                <p className="text-xs text-muted-foreground/70">
                  Configure IMAP in the Upload tab to start receiving emails.
                </p>
              </div>
            ) : (
              mails.map((mail) => (
                <button
                  key={mail.id}
                  type="button"
                  onClick={() => setSelectedId(mail.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors flex gap-3 items-start",
                    selectedId === mail.id && "bg-primary/8 border-l-2 border-l-primary",
                    !mail.isRead && selectedId !== mail.id && "bg-primary/3",
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                      !mail.isRead
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {senderInitials(mail)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Sender + date */}
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={cn(
                          "text-xs truncate",
                          !mail.isRead ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                        )}
                      >
                        {mail.senderName || mail.senderEmail || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {mail.receivedAt
                          ? formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: false })
                          : "—"}
                      </span>
                    </div>

                    {/* Subject */}
                    <p
                      className={cn(
                        "text-xs truncate mb-1",
                        !mail.isRead ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {mail.subject || "(no subject)"}
                    </p>

                    {/* Preview + badges */}
                    <div className="flex items-center gap-1.5">
                      {mail.pdfFilename && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Paperclip className="w-2.5 h-2.5" />
                          PDF
                        </span>
                      )}
                      <StatusChip status={mail.status} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: email detail ──────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Mail className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Select an email to read it</p>
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Email header */}
              <div className="px-6 py-4 border-b border-border shrink-0 space-y-3">
                <h2 className="text-lg font-semibold text-foreground leading-tight">
                  {detail.subject || "(no subject)"}
                </h2>

                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span className="font-medium text-foreground">
                      {detail.senderName || detail.senderEmail || "Unknown"}
                    </span>
                    {detail.senderName && detail.senderEmail && (
                      <span className="text-muted-foreground/70">&lt;{detail.senderEmail}&gt;</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {detail.receivedAt
                      ? format(new Date(detail.receivedAt), "MMM d, yyyy 'at' HH:mm")
                      : "—"}
                  </div>
                  {detail.isRead && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCheck className="w-3.5 h-3.5" />
                      Read
                    </div>
                  )}
                </div>

                {/* PDF attachment + Track button */}
                {detail.pdfFilename && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
                    <div className="w-9 h-9 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {detail.pdfFilename}
                      </p>
                      <p className="text-[10px] text-muted-foreground">PDF Attachment</p>
                    </div>

                    {detail.status === "extracted" && detail.quotationId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => setLocation(`/quotations/${detail.quotationId}`)}
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        View Quotation
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    ) : detail.status === "processing" ? (
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Extracting…
                      </Button>
                    ) : detail.status === "failed" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => handleTrack(detail.id)}
                        disabled={trackMut.isPending}
                      >
                        {trackMut.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Retry
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => handleTrack(detail.id)}
                        disabled={trackMut.isPending}
                      >
                        {trackMut.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <BarChart2 className="w-3.5 h-3.5" />
                        )}
                        {trackMut.isPending ? "Extracting…" : "Track PDF"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Email body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {detail.bodyHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
                  />
                ) : detail.bodyText ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                    {detail.bodyText}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No message body.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
