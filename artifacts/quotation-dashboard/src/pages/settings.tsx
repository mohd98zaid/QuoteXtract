import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  Mail,
  RefreshCw,
  Settings2,
  Webhook,
  Wifi,
  WifiOff,
  Zap,
  Send,
  Shield,
  Clock,
  Server,
  KeyRound,
  User,
  Lock,
} from "lucide-react";
import {
  useGetImapStatus,
  useGetWebhookConfig,
  useConfigureImap,
} from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatPill({
  icon,
  label,
  value,
  valueClass = "",
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border/60">
      <div className="w-8 h-8 rounded-lg bg-background border border-border/60 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm font-semibold truncate ${valueClass} ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function SectionCard({
  accent,
  icon,
  title,
  description,
  badge,
  children,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Accent header bar */}
      <div className={`h-1 w-full ${accent}`} />

      <div className="p-6 space-y-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-foreground shrink-0">
              {icon}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <div className="shrink-0 pt-0.5">{badge}</div>
        </div>

        {children}
      </div>
    </div>
  );
}

function ImapSection() {
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const { toast } = useToast();

  const { data: imap, isLoading: imapLoading, refetch, isFetching } =
    useGetImapStatus({ query: { refetchInterval: 30_000 } });

  const { data: webhookConfig, isLoading: webhookLoading } = useGetWebhookConfig({
    query: { enabled: webhookOpen },
  });

  const configureMut = useConfigureImap();

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formPassword) return;
    try {
      await configureMut.mutateAsync({ data: { email: formEmail, password: formPassword } });
      toast({ title: "Credentials saved", description: "IMAP polling is now active." });
      setFormPassword("");
      setShowChangeForm(false);
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Could not save credentials." });
    }
  };

  const isConfigured = imap?.enabled;
  const isConnected = imap?.connected;

  const badge = imapLoading ? (
    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
  ) : isConfigured && isConnected ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      Connected
    </span>
  ) : isConfigured && !isConnected ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25">
      <WifiOff className="w-3 h-3" /> Error
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
      <Settings2 className="w-3 h-3" /> Setup needed
    </span>
  );

  return (
    <SectionCard
      accent="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500"
      icon={<Mail className="w-5 h-5" />}
      title="Hostinger Email Integration"
      description="Auto-receive & extract quotation PDFs from your inbox via IMAP polling"
      badge={badge}
    >
      {imapLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !isConfigured || showChangeForm ? (
        <form onSubmit={handleSaveCredentials} className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter your Hostinger email credentials. The server will poll your inbox every 60 seconds
            and automatically extract any quotation PDFs.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="imap-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Email address
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="imap-email"
                  type="email"
                  placeholder="quotations@yourdomain.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imap-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="imap-password"
                  type="password"
                  placeholder="Your email password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                  className="pl-9"
                  autoComplete="current-password"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Pre-configured for Hostinger</p>
              <div className="flex flex-wrap gap-x-5 gap-y-0.5">
                {[
                  { l: "Host", v: "imap.hostinger.com" },
                  { l: "Port", v: "993" },
                  { l: "Encryption", v: "SSL" },
                ].map(({ l, v }) => (
                  <span key={l} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{l}:</span> {v}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={configureMut.isPending || !formEmail || !formPassword}
              className="gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-0"
            >
              {configureMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              {configureMut.isPending ? "Connecting..." : "Save & Connect"}
            </Button>
            {showChangeForm && (
              <Button variant="ghost" type="button" onClick={() => setShowChangeForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill
              icon={isConnected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
              label="Status"
              value={isConnected ? "Connected" : "Error"}
              valueClass={isConnected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
            />
            <StatPill
              icon={<Mail className="w-4 h-4" />}
              label="Account"
              value={imap.email || "—"}
              mono
            />
            <StatPill
              icon={<Server className="w-4 h-4" />}
              label="Server"
              value={`${imap.host}:${imap.port}`}
              mono
            />
            <StatPill
              icon={<Clock className="w-4 h-4" />}
              label="Poll interval"
              value={`${imap.pollIntervalSeconds}s`}
            />
          </div>

          {imap.lastCheck && (
            <p className="text-xs text-muted-foreground">
              Last checked:{" "}
              <span className="font-semibold text-foreground">
                {formatDistanceToNow(new Date(imap.lastCheck), { addSuffix: true })}
              </span>
              <span className="mx-1.5 opacity-40">·</span>
              {format(new Date(imap.lastCheck), "HH:mm:ss")}
            </p>
          )}

          {imap.lastError && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{imap.lastError}</span>
            </div>
          )}

          {isConnected && (
            <div className="flex items-start gap-2.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-200">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Polling active — any new email with a PDF attachment will be automatically extracted and appear in your upload inbox.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground rounded-lg"
              onClick={() => { setFormEmail(imap?.email || ""); setFormPassword(""); setShowChangeForm(true); }}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Change credentials
            </Button>
          </div>
        </div>
      )}

      <Separator className="my-1" />

      {/* Webhook alternative */}
      <div className="space-y-3 pt-1">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setWebhookOpen((v) => !v)}
        >
          <Webhook className="w-4 h-4" />
          Alternative: use a webhook endpoint instead
          {webhookOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-primary/30 text-primary bg-primary/5 ml-1">
            <Zap className="w-2.5 h-2.5" /> Phase 2
          </span>
        </button>

        {webhookOpen && (
          <div className="space-y-3 pl-1 pt-1">
            {webhookLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : webhookConfig ? (
              <>
                <p className="text-sm text-muted-foreground">
                  If you prefer push-based delivery, configure Hostinger to pipe raw emails to this URL instead of using IMAP polling.
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Hostinger Pipe URL", value: webhookConfig.rawEmailUrl },
                    { label: "Mailgun / SendGrid URL", value: webhookConfig.multipartUrl },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                      <div className="flex items-center gap-1.5 rounded-xl bg-muted border px-3 py-2.5">
                        <code className="text-xs text-foreground flex-1 truncate font-mono">{value}</code>
                        <CopyButton text={value} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function SmtpSection() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fromName: "",
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
  });

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ["smtp-status"],
    queryFn: async () => {
      const res = await fetch("/api/smtp/status");
      if (!res.ok) throw new Error("Failed to load SMTP status");
      return res.json() as Promise<{ host: string; port: number; secure: boolean; email: string | null; fromName: string; configured: boolean }>;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/smtp/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          fromName: form.fromName || "QuoteXtract",
          host: form.host,
          port: form.port,
          secure: form.secure,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SMTP credentials saved", description: "You can now send emails from the Compose window." });
      setShowForm(false);
      setForm((f) => ({ ...f, password: "" }));
      refetch();
    },
    onError: () => {
      toast({ variant: "destructive", title: "Save failed", description: "Could not save SMTP credentials." });
    },
  });

  const isConfigured = config?.configured;

  const badge = isLoading ? null : isConfigured ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
      <CheckCircle2 className="w-3 h-3" /> Configured
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
      <Settings2 className="w-3 h-3" /> Setup needed
    </span>
  );

  return (
    <SectionCard
      accent="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
      icon={<Send className="w-5 h-5" />}
      title="Outgoing Mail (SMTP)"
      description="Configure SMTP to send emails directly from the Compose window"
      badge={badge ?? <span />}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !isConfigured || showForm ? (
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter your Hostinger SMTP credentials to enable sending emails from the Compose window.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email address</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="smtp-email"
                  type="email"
                  placeholder="you@yourdomain.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="smtp-password"
                  type="password"
                  placeholder="Your email password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Display name</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="smtp-name"
                  placeholder="QuoteXtract"
                  value={form.fromName}
                  onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Pre-configured for Hostinger</p>
              <div className="flex flex-wrap gap-x-5 gap-y-0.5">
                {[
                  { l: "Host", v: "smtp.hostinger.com" },
                  { l: "Port", v: "465" },
                  { l: "Encryption", v: "SSL/TLS" },
                ].map(({ l, v }) => (
                  <span key={l} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{l}:</span> {v}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={saveMut.isPending || !form.email || !form.password}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0"
            >
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {saveMut.isPending ? "Saving..." : "Save & Enable"}
            </Button>
            {showForm && (
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatPill
              icon={<Mail className="w-4 h-4" />}
              label="Account"
              value={config.email || "—"}
              mono
            />
            <StatPill
              icon={<Server className="w-4 h-4" />}
              label="Server"
              value={`${config.host}:${config.port}`}
              mono
            />
            <StatPill
              icon={<Shield className="w-4 h-4" />}
              label="Encryption"
              value={config.secure ? "SSL/TLS" : "STARTTLS"}
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>SMTP configured — use the Compose button in the Mail page to send emails.</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground rounded-lg"
            onClick={() => { setForm((f) => ({ ...f, email: config?.email || "", password: "" })); setShowForm(true); }}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Change credentials
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <Settings2 className="w-4.5 h-4.5 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm pl-11">Configure integrations and application preferences.</p>
      </div>

      <ImapSection />
      <SmtpSection />
    </div>
  );
}
