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
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import {
  useGetImapStatus,
  useGetWebhookConfig,
  useConfigureImap,
} from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/60">
      <div className="w-7 h-7 rounded-lg bg-background border border-border/60 flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-xs font-semibold truncate ${valueClass} ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ connected, configured }: { connected?: boolean; configured?: boolean }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Connected
      </span>
    );
  }
  if (configured) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
        <CheckCircle2 className="w-3 h-3" /> Configured
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
      <Settings2 className="w-3 h-3" /> Setup needed
    </span>
  );
}

function IconInput({
  id,
  icon,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
}: {
  id: string;
  icon: React.ReactNode;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground">{icon}</div>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="pl-9 text-sm"
      />
    </div>
  );
}

function ImapPanel() {
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const { toast } = useToast();

  const { data: imap, isLoading, refetch, isFetching } =
    useGetImapStatus({ query: { refetchInterval: 30_000 } });

  const { data: webhookConfig, isLoading: webhookLoading } = useGetWebhookConfig({
    query: { enabled: webhookOpen },
  });

  const configureMut = useConfigureImap();

  const handleSave = async (e: React.FormEvent) => {
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

  return (
    <div className="flex flex-col gap-5 flex-1 min-w-0">
      {/* Sub-header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <ArrowDownToLine className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Incoming (IMAP)</p>
            <p className="text-[11px] text-muted-foreground">Auto-fetch PDFs from inbox</p>
          </div>
        </div>
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        ) : (
          <StatusPill connected={!!(isConfigured && isConnected)} configured={!!(isConfigured && !isConnected)} />
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !isConfigured || showChangeForm ? (
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter your Hostinger email credentials. Your inbox will be polled every 60 s for new PDFs.
          </p>
          <div className="space-y-2">
            <Label htmlFor="imap-email" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
            <IconInput id="imap-email" icon={<User className="w-3.5 h-3.5" />} type="email" placeholder="you@yourdomain.com" value={formEmail} onChange={setFormEmail} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imap-password" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
            <IconInput id="imap-password" icon={<Lock className="w-3.5 h-3.5" />} type="password" placeholder="Email password" value={formPassword} onChange={setFormPassword} required autoComplete="current-password" />
          </div>
          <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2 flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">Pre-configured: <span className="text-foreground font-medium">imap.hostinger.com:993 (SSL)</span></p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={configureMut.isPending || !formEmail || !formPassword}
              className="gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-0 text-xs">
              {configureMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              {configureMut.isPending ? "Connecting…" : "Save & Connect"}
            </Button>
            {showChangeForm && <Button variant="ghost" size="sm" type="button" className="text-xs" onClick={() => setShowChangeForm(false)}>Cancel</Button>}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatPill icon={isConnected ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />} label="Status" value={isConnected ? "Connected" : "Error"} valueClass={isConnected ? "text-green-600 dark:text-green-400" : "text-red-500"} />
            <StatPill icon={<Clock className="w-3.5 h-3.5" />} label="Poll Interval" value={`${imap.pollIntervalSeconds}s`} />
            <StatPill icon={<Mail className="w-3.5 h-3.5" />} label="Account" value={imap.email || "—"} mono />
            <StatPill icon={<Server className="w-3.5 h-3.5" />} label="Server" value={`${imap.host}:${imap.port}`} mono />
          </div>

          {imap.lastCheck && (
            <p className="text-[11px] text-muted-foreground">
              Last checked: <span className="font-semibold text-foreground">{formatDistanceToNow(new Date(imap.lastCheck), { addSuffix: true })}</span>
              <span className="mx-1 opacity-40">·</span>{format(new Date(imap.lastCheck), "HH:mm:ss")}
            </p>
          )}

          {imap.lastError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{imap.lastError}</span>
            </div>
          )}

          {isConnected && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Polling active — new PDFs will be auto-extracted and appear in your upload inbox.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground rounded-lg"
              onClick={() => { setFormEmail(imap?.email || ""); setFormPassword(""); setShowChangeForm(true); }}>
              <KeyRound className="w-3 h-3" /> Change credentials
            </Button>
          </div>
        </div>
      )}

      <Separator className="my-1" />

      {/* Webhook toggle */}
      <div className="space-y-2">
        <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setWebhookOpen((v) => !v)}>
          <Webhook className="w-3.5 h-3.5" />
          Alternative: webhook endpoint
          {webhookOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-primary/30 text-primary bg-primary/5 ml-1">
            <Zap className="w-2.5 h-2.5" /> Phase 2
          </span>
        </button>
        {webhookOpen && (
          <div className="space-y-2 pl-1">
            {webhookLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : webhookConfig ? (
              <>
                <p className="text-xs text-muted-foreground">Configure Hostinger to pipe raw emails to this URL.</p>
                {[
                  { label: "Hostinger Pipe URL", value: webhookConfig.rawEmailUrl },
                  { label: "Mailgun / SendGrid", value: webhookConfig.multipartUrl },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                    <div className="flex items-center gap-1.5 rounded-lg bg-muted border px-3 py-2">
                      <code className="text-xs flex-1 truncate font-mono">{value}</code>
                      <CopyButton text={value} />
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SmtpPanel() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fromName: "", host: "smtp.hostinger.com", port: 465, secure: true });

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
        body: JSON.stringify({ email: form.email, password: form.password, fromName: form.fromName || "QuoteXtract", host: form.host, port: form.port, secure: form.secure }),
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
    onError: () => toast({ variant: "destructive", title: "Save failed", description: "Could not save SMTP credentials." }),
  });

  const isConfigured = config?.configured;

  return (
    <div className="flex flex-col gap-5 flex-1 min-w-0">
      {/* Sub-header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <ArrowUpFromLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Outgoing (SMTP)</p>
            <p className="text-[11px] text-muted-foreground">Send emails from Compose</p>
          </div>
        </div>
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        ) : (
          <StatusPill configured={!!isConfigured} />
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !isConfigured || showForm ? (
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter your Hostinger SMTP credentials to send emails from the Compose window.
          </p>
          <div className="space-y-2">
            <Label htmlFor="smtp-email" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
            <IconInput id="smtp-email" icon={<User className="w-3.5 h-3.5" />} type="email" placeholder="you@yourdomain.com" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-password" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
            <IconInput id="smtp-password" icon={<Lock className="w-3.5 h-3.5" />} type="password" placeholder="Email password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-name" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Display name</Label>
            <IconInput id="smtp-name" icon={<Mail className="w-3.5 h-3.5" />} type="text" placeholder="QuoteXtract" value={form.fromName} onChange={(v) => setForm((f) => ({ ...f, fromName: v }))} />
          </div>
          <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2 flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">Pre-configured: <span className="text-foreground font-medium">smtp.hostinger.com:465 (SSL/TLS)</span></p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saveMut.isPending || !form.email || !form.password}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 text-xs">
              {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {saveMut.isPending ? "Saving…" : "Save & Enable"}
            </Button>
            {showForm && <Button variant="ghost" size="sm" type="button" className="text-xs" onClick={() => setShowForm(false)}>Cancel</Button>}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatPill icon={<Mail className="w-3.5 h-3.5" />} label="Account" value={config.email || "—"} mono />
            <StatPill icon={<Shield className="w-3.5 h-3.5" />} label="Encryption" value={config.secure ? "SSL/TLS" : "STARTTLS"} />
            <StatPill icon={<Server className="w-3.5 h-3.5" />} label="Server" value={`${config.host}:${config.port}`} mono />
            <StatPill icon={<Send className="w-3.5 h-3.5" />} label="From name" value={config.fromName || "QuoteXtract"} />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>SMTP configured — use the Compose button in the Mail page to send emails.</span>
          </div>

          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground rounded-lg"
            onClick={() => { setForm((f) => ({ ...f, email: config?.email || "", password: "" })); setShowForm(true); }}>
            <KeyRound className="w-3 h-3" /> Change credentials
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
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

      {/* Unified email card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Gradient accent bar — blends both colors */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 via-cyan-400 via-teal-400 to-emerald-500" />

        {/* Card header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Hostinger Email Integration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Configure incoming IMAP polling and outgoing SMTP in one place</p>
          </div>
        </div>

        {/* Two panels side by side */}
        <div className="flex divide-x divide-border">
          <div className="flex-1 p-6 min-w-0">
            <ImapPanel />
          </div>
          <div className="flex-1 p-6 min-w-0">
            <SmtpPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
