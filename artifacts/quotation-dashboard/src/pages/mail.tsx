import { useState, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  useListMail,
  useGetMail,
  useTrackMailPdf,
  getListMailQueryKey,
  getGetMailQueryKey,
  type MailItem,
} from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// ── Folder types ─────────────────────────────────────────────────────────────
type FolderName = "Inbox" | "Starred" | "Sent" | "Drafts" | "Spam" | "Trash";

// ── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
  unread: number;
  starredCount: number;
  sentCount: number;
  activeFolder: FolderName;
  onFolderChange: (f: FolderName) => void;
  onCompose: () => void;
  onFetchNow: () => void;
  fetching: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function Sidebar({
  unread,
  starredCount,
  sentCount,
  activeFolder,
  onFolderChange,
  onCompose,
  onFetchNow,
  fetching,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const folders: { icon: React.ComponentType<{ className?: string }>; label: FolderName; badge: number }[] = [
    { icon: Inbox, label: "Inbox", badge: unread },
    { icon: Star, label: "Starred", badge: starredCount },
    { icon: Send, label: "Sent", badge: sentCount },
    { icon: FileEdit, label: "Drafts", badge: 0 },
    { icon: AlertOctagon, label: "Spam", badge: 0 },
    { icon: Trash2, label: "Trash", badge: 0 },
  ];

  return (
    <div className={cn("flex flex-col h-full bg-[#1B1F3B] text-white select-none transition-[width] duration-200 overflow-hidden", collapsed ? "w-[52px]" : "w-52")}>
      {/* Logo row */}
      {collapsed ? (
        <div className="flex flex-col items-center py-3 border-b border-white/10 shrink-0 gap-2">
          <div className="w-7 h-7 rounded bg-violet-500 flex items-center justify-center text-white font-bold text-sm">
            Q
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="text-white/40 hover:text-white transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-4 border-b border-white/10 shrink-0">
          <div className="w-7 h-7 rounded bg-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            Q
          </div>
          <span className="font-semibold text-sm tracking-tight flex-1 truncate">QuoteXtract Mail</span>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="text-white/40 hover:text-white transition-colors shrink-0"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Compose */}
      <div className="px-2 pt-4 pb-2 shrink-0">
        <button
          type="button"
          onClick={onCompose}
          title={collapsed ? "Compose" : undefined}
          className={cn(
            "w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors",
          )}
        >
          <span className="text-lg leading-none">+</span>
          {!collapsed && "Compose"}
        </button>
      </div>

      {/* Folders */}
      <nav className="flex-1 px-1.5 py-1 space-y-0.5 overflow-y-auto">
        {folders.map(({ icon: Icon, label, badge }) => (
          <button
            key={label}
            type="button"
            onClick={() => onFolderChange(label)}
            title={collapsed ? label : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer",
              collapsed ? "justify-center" : "",
              activeFolder === label
                ? "bg-white/15 text-white font-medium"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{label}</span>
                {badge > 0 && (
                  <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {badge}
                  </span>
                )}
              </>
            )}
            {collapsed && badge > 0 && (
              <span className="absolute top-0 right-0 bg-violet-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Fetch now */}
      <div className="px-1.5 py-3 border-t border-white/10 shrink-0">
        <button
          type="button"
          onClick={onFetchNow}
          disabled={fetching}
          title={collapsed ? (fetching ? "Fetching…" : "Fetch from Hostinger") : undefined}
          className={cn(
            "w-full flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-2.5 py-2 rounded-lg transition-colors disabled:opacity-50",
            collapsed ? "justify-center" : "",
          )}
        >
          <RefreshCw className={cn("w-3.5 h-3.5 shrink-0", fetching && "animate-spin")} />
          {!collapsed && (fetching ? "Fetching…" : "Fetch from Hostinger")}
        </button>
      </div>
    </div>
  );
}

// ── Email row ─────────────────────────────────────────────────────────────────
interface EmailRowProps {
  mail: MailItem;
  selected: boolean;
  starred: boolean;
  onClick: () => void;
  onStar: (id: number) => void;
  onTrack: (id: number) => void;
  isTracking: boolean;
}

function EmailRow({ mail, selected, starred, onClick, onStar, onTrack, isTracking }: EmailRowProps) {
  const isUnread = !mail.isRead;
  const hasPdf = !!mail.pdfFilename;
  const isExtracted = mail.status === "extracted";
  const isProcessing = mail.status === "processing";

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
            {mail.source === "sent"
              ? `To: ${mail.recipientEmail || "unknown"}`
              : (mail.senderName || mail.senderEmail || "Unknown sender")}
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
          <div className="flex items-center gap-1.5 shrink-0">
            {hasPdf && !isExtracted && !isProcessing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTrack(mail.id); }}
                    disabled={isTracking}
                    className={cn(
                      "hidden group-hover:flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-colors",
                      "bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60"
                    )}
                  >
                    {isTracking ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <BarChart2 className="w-2.5 h-2.5" />
                    )}
                    Track
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Send PDF to Dashboard</TooltipContent>
              </Tooltip>
            )}
            {hasPdf && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Paperclip className={cn("w-3 h-3", isExtracted ? "text-green-500" : "text-muted-foreground")} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isExtracted ? "PDF tracked in dashboard" : "PDF attached"}
                </TooltipContent>
              </Tooltip>
            )}
            {isProcessing && (
              <Loader2 className="w-3 h-3 text-violet-500 animate-spin" />
            )}
            {isExtracted && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Tracked in dashboard</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Star */}
      <button
        type="button"
        className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onStar(mail.id); }}
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
interface ComposeData { title: string; initialTo: string; initialCc: string; initialSubject: string; initialBody: string; }

const MAIL_LABELS = ["Important", "Follow-up", "Quotation", "Contract", "Spam"];

interface ReadingPaneProps {
  mailId: number;
  onTrack: (id: number) => Promise<void>;
  tracking: boolean;
}

function ReadingPane({ mailId, onTrack, tracking }: ReadingPaneProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [composeData, setComposeData] = useState<ComposeData | null>(null);
  const queryClient = useQueryClient();

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

  const quotedText = (prefix: string) => {
    const dateStr = detail.receivedAt ? format(new Date(detail.receivedAt), "EEEE, MMMM d, yyyy 'at' HH:mm") : "";
    const from = detail.senderName
      ? `${detail.senderName}${detail.senderEmail ? ` <${detail.senderEmail}>` : ""}`
      : (detail.senderEmail ?? "Unknown");
    return `\n\n${prefix}\nFrom: ${from}\nDate: ${dateStr}\nSubject: ${detail.subject ?? ""}\n\n${detail.bodyText ?? ""}`;
  };

  const openReply = () => setComposeData({
    title: "Reply",
    initialTo: detail.senderEmail ?? "",
    initialCc: "",
    initialSubject: `Re: ${detail.subject ?? ""}`,
    initialBody: quotedText("--- Original message ---"),
  });

  const openReplyAll = () => setComposeData({
    title: "Reply All",
    initialTo: detail.senderEmail ?? "",
    initialCc: "",
    initialSubject: `Re: ${detail.subject ?? ""}`,
    initialBody: quotedText("--- Original message ---"),
  });

  const openForward = () => setComposeData({
    title: "Forward",
    initialTo: "",
    initialCc: "",
    initialSubject: `Fwd: ${detail.subject ?? ""}`,
    initialBody: quotedText("--- Forwarded message ---"),
  });

  const handlePrint = () => window.print();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header actions bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {[
            { icon: Reply, label: "Reply", action: openReply },
            { icon: ReplyAll, label: "Reply All", action: openReplyAll },
            { icon: Forward, label: "Forward", action: openForward },
          ].map(({ icon: Icon, label, action }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={action}
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
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Label</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              {MAIL_LABELS.map((label) => (
                <DropdownMenuItem key={label} onClick={() => toast({ title: `Labelled as "${label}"` })}>
                  <Tag className="w-3.5 h-3.5 mr-2 text-violet-500" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={handlePrint} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-4 max-w-4xl">
          {/* Subject */}
          <h2 className="text-xl font-bold text-foreground leading-tight">
            {detail.subject || "(no subject)"}
          </h2>

          {/* Sender / recipient info card */}
          <div className="flex items-start gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0", avatarColor(detail.id))}>
              {senderAbbr(detail)}
            </div>
            <div className="flex-1 min-w-0">
              {detail.source === "sent" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">From:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {detail.senderName || detail.senderEmail || "Me"}
                  </span>
                  {detail.senderName && detail.senderEmail && (
                    <span className="text-xs text-muted-foreground">&lt;{detail.senderEmail}&gt;</span>
                  )}
                  <span className="text-xs text-muted-foreground font-medium ml-2">To:</span>
                  <span className="text-sm text-foreground">{(detail as any).recipientEmail || "—"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">
                    {detail.senderName || detail.senderEmail || "Unknown"}
                  </span>
                  {detail.senderName && detail.senderEmail && (
                    <span className="text-xs text-muted-foreground">&lt;{detail.senderEmail}&gt;</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span>
                  {detail.receivedAt
                    ? format(new Date(detail.receivedAt), "EEEE, MMMM d, yyyy 'at' HH:mm")
                    : "—"}
                </span>
                {detail.isRead && detail.source !== "sent" && (
                  <span className="flex items-center gap-1 text-muted-foreground/60">
                    <CheckCircle2 className="w-3 h-3" /> Read
                  </span>
                )}
                {detail.source === "sent" && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-3 h-3" /> Sent
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

      {composeData && (
        <ComposeDialog
          {...composeData}
          onClose={() => setComposeData(null)}
          onSent={() => {
            setComposeData(null);
            queryClient.invalidateQueries({ queryKey: getListMailQueryKey({ source: "sent" }) });
          }}
        />
      )}
    </div>
  );
}

// ── Folder empty states ───────────────────────────────────────────────────────
const FOLDER_EMPTY: Record<FolderName, { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }> = {
  Inbox: { icon: Inbox, title: "Inbox is empty", desc: "New emails will appear here automatically." },
  Starred: { icon: Star, title: "No starred emails", desc: "Star emails you want to find easily later." },
  Sent: { icon: Send, title: "No sent emails", desc: "Emails you send will appear here." },
  Drafts: { icon: FileEdit, title: "No drafts", desc: "Drafts will appear here once created." },
  Spam: { icon: AlertOctagon, title: "No spam", desc: "Spam emails from Hostinger will appear here." },
  Trash: { icon: Trash2, title: "Trash is empty", desc: "Deleted emails will appear here." },
};

// ── Compose dialog ───────────────────────────────────────────────────────────
interface ComposeDialogProps {
  onClose: () => void;
  onSent: () => void;
  title?: string;
  initialTo?: string;
  initialCc?: string;
  initialSubject?: string;
  initialBody?: string;
}
interface FromOption { email: string; name: string; label: string; }

function ComposeDialog({
  onClose, onSent,
  title = "New Message",
  initialTo = "",
  initialCc = "",
  initialSubject = "",
  initialBody = "",
}: ComposeDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [selectedFrom, setSelectedFrom] = useState<FromOption | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [enhancing, setEnhancing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: smtpStatus } = useQuery({
    queryKey: ["smtp-status"],
    queryFn: async () => {
      const res = await fetch("/api/smtp/status");
      return res.json() as Promise<{ email: string | null; fromName: string; configured: boolean }>;
    },
    staleTime: 60_000,
  });

  const { data: aliasesData } = useQuery({
    queryKey: ["smtp-aliases"],
    queryFn: async () => {
      const res = await fetch("/api/smtp/aliases");
      return res.json() as Promise<{ aliases: { email: string; name: string }[] }>;
    },
    staleTime: 30_000,
  });

  const fromOptions: FromOption[] = smtpStatus?.email
    ? [
        { email: smtpStatus.email, name: smtpStatus.fromName || "QuoteXtract", label: `${smtpStatus.fromName || "QuoteXtract"} <${smtpStatus.email}>` },
        ...(aliasesData?.aliases ?? []).map((a) => ({ email: a.email, name: a.name, label: `${a.name} <${a.email}>` })),
      ]
    : [];

  const activeFrom = selectedFrom ?? fromOptions[0] ?? null;
  const hasMultipleFrom = fromOptions.length > 1;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const duplicates = files.filter((f) => attachments.some((a) => a.name === f.name && a.size === f.size));
    const newFiles = files.filter((f) => !attachments.some((a) => a.name === f.name && a.size === f.size));
    setAttachments((prev) => [...prev, ...newFiles]);
    if (duplicates.length > 0) toast({ title: "Duplicate skipped", description: `${duplicates.map((d) => d.name).join(", ")} already attached.` });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => setAttachments((prev) => prev.filter((_, i) => i !== index));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in To, Subject, and message body." });
      return;
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("to", to.trim());
      if (cc.trim()) formData.append("cc", cc.trim());
      formData.append("subject", subject.trim());
      formData.append("text", body.trim());
      if (activeFrom?.email) formData.append("fromEmail", activeFrom.email);
      if (activeFrom?.name) formData.append("fromName", activeFrom.name);
      attachments.forEach((file) => formData.append("attachments", file));

      const res = await fetch("/api/mail/send", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      toast({ title: "Email sent!", description: `Message delivered to ${to}.` });
      onSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      toast({ variant: "destructive", title: "Send failed", description: msg });
    } finally {
      setSending(false);
    }
  };
  const handleEnhance = async () => {
    if (!body.trim()) {
      toast({ title: "Draft is empty", description: "Type a rough idea of what you want to say first!" });
      return;
    }
    setEnhancing(true);
    try {
      const res = await fetch("/api/mail/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText: body, originalText: initialBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to elevate draft");
      setBody(data.enhanced);
      toast({ title: "Draft enhanced ✨", description: "AI has rewritten your message." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Enhancement failed";
      toast({ variant: "destructive", title: "AI Error", description: msg });
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      <div className="w-[520px] bg-card border border-border rounded-xl shadow-2xl flex flex-col pointer-events-auto max-h-[640px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1B1F3B] rounded-t-xl shrink-0">
          <span className="text-sm font-semibold text-white">{title}</span>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Fields */}
        <div className="divide-y divide-border shrink-0">
          {/* From */}
          {fromOptions.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="text-xs text-muted-foreground w-12 shrink-0">From</span>
              {hasMultipleFrom ? (
                <DropdownMenu open={fromDropdownOpen} onOpenChange={setFromDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex-1 flex items-center justify-between h-7 text-sm text-foreground bg-transparent hover:bg-muted/50 rounded px-1.5 transition-colors"
                    >
                      <span className="truncate">{activeFrom?.label ?? "Select sender…"}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[400px]">
                    {fromOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.email}
                        onClick={() => { setSelectedFrom(opt); setFromDropdownOpen(false); }}
                        className={cn(activeFrom?.email === opt.email && "bg-accent")}
                      >
                        <Send className="w-3.5 h-3.5 mr-2 text-violet-500 shrink-0" />
                        <span className="truncate">{opt.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-sm text-foreground truncate">{activeFrom?.label}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-xs text-muted-foreground w-12 shrink-0">To</span>
            <input
              className="flex-1 h-7 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-xs text-muted-foreground w-12 shrink-0">Cc</span>
            <input
              className="flex-1 h-7 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="optional"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-xs text-muted-foreground w-12 shrink-0">Subject</span>
            <input
              className="flex-1 h-7 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="Subject line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>
        {/* Body */}
        <textarea
          className="flex-1 resize-none px-4 py-3 text-sm bg-transparent outline-none min-h-[160px] text-foreground placeholder:text-muted-foreground"
          placeholder="Write your message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* Attachments list */}
        {attachments.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-border pt-2 shrink-0">
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-xs max-w-[220px]">
                <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground font-medium">{file.name}</span>
                <span className="text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                <button type="button" onClick={() => removeAttachment(i)} className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
              onClick={handleSend}
              disabled={sending}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? "Sending…" : "Send"}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-violet-500/30 text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:text-violet-400 dark:border-violet-400/30 dark:hover:bg-violet-500/20 px-2"
                  onClick={handleEnhance}
                  disabled={enhancing || sending}
                >
                  {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span className="hidden sm:inline">{enhancing ? "✨ Writing..." : "✨ AI Enhance"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Rewrite my draft politely</TooltipContent>
            </Tooltip>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              type="button"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
          <button type="button" className="text-muted-foreground hover:text-destructive transition-colors" onClick={onClose}>
            <Trash2 className="w-4 h-4" />
          </button>
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
  const [activeFolder, setActiveFolder] = useState<FolderName>("Inbox");
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);
  const [trackingRowId, setTrackingRowId] = useState<number | null>(null);
  const [mailSidebarCollapsed, setMailSidebarCollapsed] = useState(
    () => localStorage.getItem("mail_sidebar_collapsed") === "true"
  );

  const toggleMailSidebar = (value: boolean) => {
    setMailSidebarCollapsed(value);
    localStorage.setItem("mail_sidebar_collapsed", String(value));
  };

  const { data: mails, isLoading, refetch } = useListMail({
    query: { refetchInterval: 60_000 },
  });

  const { data: sentMails, refetch: refetchSent } = useListMail({
    params: { source: "sent" },
    query: { refetchInterval: 60_000 },
  });

  const fetchNowMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/mail/fetch", { method: "POST" });
      if (!res.ok) throw new Error("Fetch failed");
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: getListMailQueryKey() });
        refetch();
      }, 3000);
      toast({ title: "Fetching mail…", description: "New emails will appear in a few seconds." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Fetch failed", description: "Could not connect to your mailbox." });
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

  const handleTrackRow = async (mailId: number) => {
    setTrackingRowId(mailId);
    try {
      const result = await trackMut.mutateAsync({ id: mailId });
      queryClient.invalidateQueries({ queryKey: getListMailQueryKey() });
      if (result.alreadyTracked) {
        toast({ title: "Already tracked", description: "This PDF is already in your quotations." });
      } else {
        toast({
          title: "PDF sent to Dashboard",
          description: "Quotation extracted and ready to review.",
        });
      }
      setLocation(`/quotations/${result.quotationId}`);
    } catch {
      toast({ variant: "destructive", title: "Tracking failed", description: "Could not extract the PDF. Try again." });
    } finally {
      setTrackingRowId(null);
    }
  };

  const handleSelectMail = (id: number) => {
    setSelectedId(id);
    queryClient.invalidateQueries({ queryKey: getListMailQueryKey() });
  };

  const handleStar = (id: number) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFolderChange = (folder: FolderName) => {
    setActiveFolder(folder);
    setSelectedId(null);
    setSearch("");
  };

  const allMails = mails || [];
  const unread = allMails.filter((m) => !m.isRead).length;
  const starredCount = starredIds.size;

  // Filter by folder first, then search
  const folderMails = (() => {
    switch (activeFolder) {
      case "Inbox": return allMails;
      case "Starred": return allMails.filter((m) => starredIds.has(m.id));
      case "Sent": return sentMails || [];
      case "Drafts":
      case "Spam":
      case "Trash":
        return [];
    }
  })();

  const filtered = folderMails.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.subject?.toLowerCase().includes(q) ||
      m.senderName?.toLowerCase().includes(q) ||
      m.senderEmail?.toLowerCase().includes(q) ||
      m.recipientEmail?.toLowerCase().includes(q) ||
      m.bodyText?.toLowerCase().includes(q)
    );
  });

  const emptyState = FOLDER_EMPTY[activeFolder];
  const EmptyIcon = emptyState.icon;

  return (
    <div className="flex h-full overflow-hidden bg-background border border-border">

      {/* ── Sidebar ─────────────────────────── */}
      <div className="shrink-0 h-full">
        <Sidebar
          unread={unread}
          starredCount={starredCount}
          sentCount={sentMails?.length ?? 0}
          activeFolder={activeFolder}
          onFolderChange={handleFolderChange}
          onCompose={() => setComposeOpen(true)}
          onFetchNow={() => fetchNowMut.mutate()}
          fetching={fetchNowMut.isPending}
          collapsed={mailSidebarCollapsed}
          onToggleCollapse={() => toggleMailSidebar(!mailSidebarCollapsed)}
        />
      </div>

      {/* ── Email list ──────────────────────── */}
      <div className="w-80 shrink-0 border-x border-border flex flex-col min-h-0 bg-background">
        {/* List header */}
        <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">{activeFolder}</span>
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "message" : "messages"}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={`Search ${activeFolder.toLowerCase()}…`}
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
          {activeFolder === "Inbox" && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <button type="button" className="flex items-center gap-1 hover:text-foreground transition-colors">
                Sort: Newest <ChevronDown className="w-3 h-3" />
              </button>
              {unread > 0 && (
                <span className="text-violet-600 font-medium">{unread} unread</span>
              )}
            </div>
          )}
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
                <EmptyIcon className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search ? `No results in ${activeFolder}` : emptyState.title}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground/70">{emptyState.desc}</p>
              )}
            </div>
          ) : (
            filtered.map((mail) => (
              <EmailRow
                key={mail.id}
                mail={mail}
                selected={selectedId === mail.id}
                starred={starredIds.has(mail.id)}
                onClick={() => handleSelectMail(mail.id)}
                onStar={handleStar}
                onTrack={handleTrackRow}
                isTracking={trackingRowId === mail.id}
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
              <EmptyIcon className="w-9 h-9 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground mb-1">
                {filtered.length > 0 ? "Select a message to read" : emptyState.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {filtered.length > 0
                  ? "Choose an email from the list on the left."
                  : emptyState.desc}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Compose dialog ──────────────────── */}
      {composeOpen && (
        <ComposeDialog
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            queryClient.invalidateQueries({ queryKey: getListMailQueryKey({ source: "sent" }) });
          }}
        />
      )}
    </div>
  );
}
