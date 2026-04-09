import { useState } from "react";
import { useLocation } from "wouter";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  Inbox,
  Star,
  Send,
  FileEdit,
  Trash2,
  AlertOctagon,
  ChevronDown,
  Search,
  RefreshCw,
  Paperclip,
  Reply,
  ReplyAll,
  Forward,
  MoreHorizontal,
  Loader2,
  BarChart2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Maximize2,
  Printer,
  Tag,
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
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function senderAbbr(mail: MailItem): string {
  const src = mail.senderName || mail.senderEmail || "?";
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-red-500",
  "bg-indigo-500",
];

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
  unread: number;
  onRefresh: () => void;
  refreshing: boolean;
}

function Sidebar({ unread, onRefresh, refreshing }: SidebarProps) {
  const folders = [
    { icon: Inbox, label: "Inbox", badge: unread, active: true },
    { icon: Star, label: "Starred", badge: 0 },
    { icon: Send, label: "Sent", badge: 0 },
    { icon: FileEdit, label: "Drafts", badge: 0 },
    { icon: AlertOctagon, label: "Spam", badge: 0 },
    { icon: Trash2, label: "Trash", badge: 0 },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1B1F3B] text-white select-none">
      {/* Logo row */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10 shrink-0">
        <div className="w-7 h-7 rounded bg-violet-500 flex items-center justify-center text-white font-bold text-sm">
          Q
        </div>
        <span className="font-semibold text-sm tracking-tight">QuoteXtract Mail</span>
      </div>

      {/* Compose */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Compose
        </button>
      </div>

      {/* Folders */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {folders.map(({ icon: Icon, label, badge, active }) => (
          <button
            key={label}
            type="button"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              active
                ? "bg-white/15 text-white font-medium"
                : "text-white/60 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {badge > 0 && (
              <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Refresh */}
      <div className="px-3 py-3 border-t border-white/10 shrink-0">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="w-full flex items-center gap-2 text-white/50 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-white/8 transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Checking…" : "Check for new mail"}
        </button>
      </div>
    </div>
  );
}

// ── Email row ─────────────────────────────────────────────────────────────────
interface EmailRowProps {
  mail: MailItem;
  selected: boolean;
  onClick: () => void;
}

function EmailRow({ mail, selected, onClick }: EmailRowProps) {
  const [starred, setStarred] = useState(false);
  const isUnread = !mail.isRead;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border/40 transition-colors group",
        selected ? "bg-violet-50 dark:bg-violet-950/30 border-l-2 border-l-violet-500" : "hover:bg-muted/60",
        isUnread && !selected && "bg-white dark:bg-card",
      )}
    >
      {/* Unread dot */}
      <div className="flex items-center justify-center w-2 mt-2 shrink-0">
        {isUnread && !selected && (
          <div className="w-2 h-2 rounded-full bg-violet-500" />
        )}
      </div>

      {/* Avatar */}
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5",
          avatarColor(mail.id),
        )}
      >
        {senderAbbr(mail)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={cn(
              "text-sm truncate",
              isUnread ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
            )}
          >
            {mail.senderName || mail.senderEmail || "Unknown sender"}
          </span>
          <span className="text-[11px] text-muted-foreground ml-2 shrink-0">
            {formatDate(mail.receivedAt)}
          </span>
        </div>

        <p
          className={cn(
            "text-xs truncate mb-1",
            isUnread ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {mail.subject || "(no subject)"}
        </p>

        <div className="flex items-center gap-2">
          <p className="text-[11px] text-muted-foreground/70 truncate flex-1">
            {mail.bodyText?.slice(0, 80) || ""}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {mail.pdfFilename && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Paperclip className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">PDF attached</TooltipContent>
              </Tooltip>
            )}
            {mail.status === "extracted" && (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            )}
          </div>
        </div>
      </div>

      {/* Star */}
      <button
        type="button"
        className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); setStarred((v) => !v); }}
      >
        <Star
          className={cn(
            "w-3.5 h-3.5 transition-colors",
            starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
          )}
        />
      </button>
    </div>
  );
}

// ── Reading pane ──────────────────────────────────────────────────────────────
interface ReadingPaneProps {
  mailId: number;
  onTrack: (id: number) => Promise<void>;
  tracking: boolean;
}

function ReadingPane({ mailId, onTrack, tracking }: ReadingPaneProps) {
  const [, setLocation] = useLocation();

  const { data: detail, isLoading } = useGetMail(mailId, {
    query: { enabled: mailId > 0 },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header actions bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {[
            { icon: Reply, label: "Reply" },
            { icon: ReplyAll, label: "Reply All" },
            { icon: Forward, label: "Forward" },
          ].map(({ icon: Icon, label }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
            </Tooltip>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Delete</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Tag className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Label</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Printer className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Print</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Expand</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">More</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-4 max-w-4xl">
          {/* Subject */}
          <h2 className="text-xl font-bold text-foreground leading-tight">
            {detail.subject || "(no subject)"}
          </h2>

          {/* Sender info card */}
          <div className="flex items-start gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0", avatarColor(detail.id))}>
              {senderAbbr(detail)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">
                  {detail.senderName || detail.senderEmail || "Unknown"}
                </span>
                {detail.senderName && detail.senderEmail && (
                  <span className="text-xs text-muted-foreground">&lt;{detail.senderEmail}&gt;</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span>
                  {detail.receivedAt
                    ? format(new Date(detail.receivedAt), "EEEE, MMMM d, yyyy 'at' HH:mm")
                    : "—"}
                </span>
                {detail.isRead && (
                  <span className="flex items-center gap-1 text-muted-foreground/60">
                    <CheckCircle2 className="w-3 h-3" /> Read
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* PDF Attachment — prominent card */}
          {detail.pdfFilename && (
            <div className="flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20 border-violet-200/60 dark:border-violet-800/40">
              <div className="w-11 h-11 rounded-xl bg-white dark:bg-card border border-border shadow-sm flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{detail.pdfFilename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">PDF Attachment · Quotation document</p>
              </div>

              {/* Track action */}
              <div className="shrink-0">
                {detail.status === "extracted" && detail.quotationId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs gap-2 border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => setLocation(`/quotations/${detail.quotationId}`)}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    View Quotation
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                ) : detail.status === "processing" ? (
                  <Button size="sm" variant="outline" className="h-9 text-xs gap-2" disabled>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Extracting…
                  </Button>
                ) : detail.status === "failed" ? (
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="destructive" className="text-[10px]">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" /> Extraction failed
                    </Badge>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700"
                      onClick={() => onTrack(detail.id)}
                      disabled={tracking}
                    >
                      {tracking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Retry
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-9 text-sm gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                    onClick={() => onTrack(detail.id)}
                    disabled={tracking}
                  >
                    {tracking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BarChart2 className="w-4 h-4" />
                    )}
                    {tracking ? "Extracting…" : "Track PDF"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Email body */}
          <div className="pb-8">
            {detail.bodyHtml ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
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
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MailPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: mails, isLoading, refetch, isFetching } = useListMail({
    query: { refetchInterval: 30_000 },
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

  const handleSelectMail = (id: number) => {
    setSelectedId(id);
    queryClient.invalidateQueries({ queryKey: getListMailQueryKey() });
  };

  const unread = (mails || []).filter((m) => !m.isRead).length;

  const filtered = (mails || []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.subject?.toLowerCase().includes(q) ||
      m.senderName?.toLowerCase().includes(q) ||
      m.senderEmail?.toLowerCase().includes(q) ||
      m.bodyText?.toLowerCase().includes(q)
    );
  });

  return (
    // Full-bleed: remove parent padding
    <div className="flex h-full -m-4 md:-m-8 overflow-hidden rounded-none bg-background border border-border">

      {/* ── Sidebar ─────────────────────────── */}
      <div className="w-52 shrink-0">
        <Sidebar unread={unread} onRefresh={() => refetch()} refreshing={isFetching} />
      </div>

      {/* ── Email list ──────────────────────── */}
      <div className="w-80 shrink-0 border-x border-border flex flex-col min-h-0 bg-background">
        {/* List header */}
        <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">Inbox</span>
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "message" : "messages"}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search mail…"
              className="pl-8 h-8 text-xs bg-muted/50 border-0 focus-visible:ring-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <button type="button" className="flex items-center gap-1 hover:text-foreground transition-colors">
              Sort: Newest <ChevronDown className="w-3 h-3" />
            </button>
            {unread > 0 && (
              <span className="text-violet-600 font-medium">{unread} unread</span>
            )}
          </div>
        </div>

        {/* Email rows */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Inbox className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No matching emails" : "No emails yet"}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground/70">
                  Configure IMAP in the Upload tab to start receiving emails automatically.
                </p>
              )}
            </div>
          ) : (
            filtered.map((mail) => (
              <EmailRow
                key={mail.id}
                mail={mail}
                selected={selectedId === mail.id}
                onClick={() => handleSelectMail(mail.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Reading pane ────────────────────── */}
      <div className="flex-1 min-w-0 min-h-0">
        {selectedId ? (
          <ReadingPane
            mailId={selectedId}
            onTrack={handleTrack}
            tracking={trackMut.isPending}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="w-9 h-9 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground mb-1">
                {mails && mails.length > 0 ? "Select a message to read" : "Your inbox is empty"}
              </p>
              <p className="text-sm text-muted-foreground">
                {mails && mails.length > 0
                  ? "Choose an email from the list on the left."
                  : "New emails with PDF attachments will appear here automatically."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
