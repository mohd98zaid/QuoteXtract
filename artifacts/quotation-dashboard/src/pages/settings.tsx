import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Settings2,
  Wifi,
  WifiOff,
  Send,
  Shield,
  Clock,
  Server,
  KeyRound,
  User,
  Lock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Tag,
  Plus,
  Trash2,
  AtSign,
} from "lucide-react";
import {
  useGetImapStatus,
  useConfigureImap,
  getGetImapStatusQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Image as ImageIcon } from "lucide-react";

interface EmailAlias { email: string; name: string; }

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

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

function StatusPill({ connected, configured, loading }: { connected?: boolean; configured?: boolean; loading?: boolean }) {
  if (loading) return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Connected
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
  id, icon, type = "text", placeholder, value, onChange, required, autoComplete,
}: {
  id: string; icon: React.ReactNode; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void; required?: boolean; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground">{icon}</div>
      <Input id={id} type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} required={required}
        autoComplete={autoComplete} className="pl-9 text-sm" />
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [newAliasEmail, setNewAliasEmail] = useState("");
  const [newAliasName, setNewAliasName] = useState("");

  const [logoDataUrl, setLogoDataUrl] = useState<string>(() => localStorage.getItem("quotation_logo") || "");
  const [stampDataUrl, setStampDataUrl] = useState<string>(() => localStorage.getItem("quotation_stamp") || "");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await toBase64(e.target.files[0]);
      try {
        localStorage.setItem(key, base64);
        setter(base64);
        toast({ title: "Template updated", description: `Default ${key.split('_')[1]} saved.` });
      } catch (err) {
        toast({ variant: "destructive", title: "Image too large", description: "Failed to save. Try a smaller image." });
      }
    }
  };

  const { data: imap, isLoading: imapLoading, refetch: refetchImap, isFetching: imapFetching } =
    useGetImapStatus({ query: { queryKey: getGetImapStatusQueryKey(), refetchInterval: 60_000 } });

  const { data: smtp, isLoading: smtpLoading, refetch: refetchSmtp } = useQuery({
    queryKey: ["smtp-status"],
    queryFn: async () => {
      const res = await fetch("/api/smtp/status");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ host: string; port: number; secure: boolean; email: string | null; fromName: string; configured: boolean }>;
    },
  });

  const configureImapMut = useConfigureImap();

  const configureSmtpMut = useMutation({
    mutationFn: async (payload: { email: string; password: string; fromName: string }) => {
      const res = await fetch("/api/smtp/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          fromName: payload.fromName || "QuoteXtract",
          host: "smtp.hostinger.com",
          port: 465,
          secure: true,
        }),
      });
      if (!res.ok) throw new Error("SMTP save failed");
      return res.json();
    },
  });

  const { data: aliasesData, refetch: refetchAliases } = useQuery({
    queryKey: ["smtp-aliases"],
    queryFn: async () => {
      const res = await fetch("/api/smtp/aliases");
      return res.json() as Promise<{ aliases: EmailAlias[] }>;
    },
  });

  const addAliasMut = useMutation({
    mutationFn: async (alias: EmailAlias) => {
      const res = await fetch("/api/smtp/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alias),
      });
      if (!res.ok) throw new Error("Failed to add alias");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["smtp-aliases"] }); },
  });

  const removeAliasMut = useMutation({
    mutationFn: async (aliasEmail: string) => {
      const res = await fetch(`/api/smtp/aliases/${encodeURIComponent(aliasEmail)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove alias");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["smtp-aliases"] }); },
  });

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasEmail.trim()) return;
    try {
      await addAliasMut.mutateAsync({ email: newAliasEmail.trim(), name: newAliasName.trim() || newAliasEmail.trim() });
      toast({ title: "Alias added", description: `${newAliasEmail} added as a sender alias.` });
      setNewAliasEmail("");
      setNewAliasName("");
    } catch {
      toast({ variant: "destructive", title: "Failed", description: "Could not add alias." });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      await Promise.all([
        configureImapMut.mutateAsync({ data: { email, password } }),
        configureSmtpMut.mutateAsync({ email, password, fromName }),
      ]);
      toast({ title: "Credentials saved", description: "IMAP polling and SMTP sending are now active." });
      setPassword("");
      setShowForm(false);
      refetchImap();
      refetchSmtp();
    } catch {
      toast({ variant: "destructive", title: "Save failed", description: "Could not save credentials. Check your email and password." });
    }
  };

  const isPending = configureImapMut.isPending || configureSmtpMut.isPending;
  const isAnyConfigured = imap?.enabled || smtp?.configured;
  const showCredentialForm = !isAnyConfigured || showForm;

  const currentEmail = imap?.email || smtp?.email || "";

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm pl-11">Configure integrations and application preferences.</p>
      </div>

      {/* Unified email card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 via-cyan-400 via-teal-400 to-emerald-500" />

        {/* Card header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Hostinger Email Integration</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Shared credentials for incoming (IMAP) and outgoing (SMTP)</p>
            </div>
          </div>
          {!showCredentialForm && currentEmail && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono text-muted-foreground hidden sm:block">{currentEmail}</span>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg"
                onClick={() => { setEmail(currentEmail); setPassword(""); setFromName(smtp?.fromName || ""); setShowForm(true); }}>
                <KeyRound className="w-3 h-3" /> Change credentials
              </Button>
            </div>
          )}
        </div>

        {/* Shared credentials form */}
        {showCredentialForm && (
          <div className="px-6 py-5 border-b border-border">
            <form onSubmit={handleSave} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your Hostinger email credentials once — they will be applied to both incoming mail (IMAP) and outgoing mail (SMTP).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shared-email" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Email address</Label>
                  <IconInput id="shared-email" icon={<User className="w-3.5 h-3.5" />} type="email"
                    placeholder="you@yourdomain.com" value={email} onChange={setEmail} required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shared-password" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
                  <IconInput id="shared-password" icon={<Lock className="w-3.5 h-3.5" />} type="password"
                    placeholder="Email password" value={password} onChange={setPassword} required autoComplete="current-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shared-name" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Display name</Label>
                  <IconInput id="shared-name" icon={<Tag className="w-3.5 h-3.5" />} type="text"
                    placeholder="QuoteXtract" value={fromName} onChange={setFromName} autoComplete="name" />
                </div>
              </div>

              <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 flex flex-wrap gap-x-8 gap-y-1 items-center">
                <div className="flex items-center gap-2">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">IMAP: <span className="font-semibold text-foreground font-mono">imap.hostinger.com:993 (SSL)</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">SMTP: <span className="font-semibold text-foreground font-mono">smtp.hostinger.com:465 (SSL/TLS)</span></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={isPending || !email || !password}
                  className="gap-1.5 bg-gradient-to-r from-violet-600 to-emerald-600 hover:from-violet-700 hover:to-emerald-700 text-white border-0">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  {isPending ? "Saving…" : "Save & Connect Both"}
                </Button>
                {showForm && (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Status panels — only shown when configured */}
        {!showCredentialForm && (
          <div className="flex divide-x divide-border">
            {/* IMAP status */}
            <div className="flex-1 p-6 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <ArrowDownToLine className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Incoming (IMAP)</p>
                </div>
                <StatusPill loading={imapLoading} connected={!!(imap?.enabled && imap?.connected)} configured={!!(imap?.enabled && !imap?.connected)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatPill
                  icon={imap?.connected ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 text-red-500" />}
                  label="Status" value={imap?.connected ? "Connected" : "Error"}
                  valueClass={imap?.connected ? "text-green-600 dark:text-green-400" : "text-red-500"}
                />
                <StatPill icon={<Clock className="w-3.5 h-3.5" />} label="Poll interval" value={`${imap?.pollIntervalSeconds ?? 60}s`} />
                <StatPill icon={<Server className="w-3.5 h-3.5" />} label="Server" value={`${imap?.host ?? "imap.hostinger.com"}:${imap?.port ?? 993}`} mono />
                <StatPill icon={<Shield className="w-3.5 h-3.5" />} label="Encryption" value="SSL" />
              </div>

              {imap?.lastCheck && (
                <p className="text-[11px] text-muted-foreground">
                  Last checked: <span className="font-semibold text-foreground">{formatDistanceToNow(new Date(imap.lastCheck), { addSuffix: true })}</span>
                  <span className="mx-1.5 opacity-40">·</span>{format(new Date(imap.lastCheck), "HH:mm:ss")}
                </p>
              )}

              {imap?.lastError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{imap.lastError}</span>
                </div>
              )}

              {imap?.connected && (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-xs text-green-700 dark:text-green-300">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Polling active — new PDFs are auto-extracted every {imap.pollIntervalSeconds}s.</span>
                </div>
              )}

              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg" onClick={() => refetchImap()} disabled={imapFetching}>
                <RefreshCw className={`w-3 h-3 ${imapFetching ? "animate-spin" : ""}`} /> Refresh status
              </Button>
            </div>

            {/* SMTP status */}
            <div className="flex-1 p-6 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Outgoing (SMTP)</p>
                </div>
                <StatusPill loading={smtpLoading} configured={!!smtp?.configured} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatPill icon={<Mail className="w-3.5 h-3.5" />} label="Account" value={smtp?.email || "—"} mono />
                <StatPill icon={<Shield className="w-3.5 h-3.5" />} label="Encryption" value={smtp?.secure ? "SSL/TLS" : "STARTTLS"} />
                <StatPill icon={<Server className="w-3.5 h-3.5" />} label="Server" value={`${smtp?.host ?? "smtp.hostinger.com"}:${smtp?.port ?? 465}`} mono />
                <StatPill icon={<Send className="w-3.5 h-3.5" />} label="From name" value={smtp?.fromName || "QuoteXtract"} />
              </div>

              {smtp?.configured && (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Ready — use the Compose button in the Mail page to send emails.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sender Aliases card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-blue-500" />

        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <AtSign className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Sender Aliases</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add alias email addresses to choose from when composing or replying to mail.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Existing aliases */}
          {aliasesData?.aliases && aliasesData.aliases.length > 0 ? (
            <div className="space-y-2">
              {aliasesData.aliases.map((alias) => (
                <div key={alias.email} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/60">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                    <AtSign className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{alias.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{alias.email}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    disabled={removeAliasMut.isPending}
                    onClick={async () => {
                      try {
                        await removeAliasMut.mutateAsync(alias.email);
                        toast({ title: "Alias removed", description: `${alias.email} removed.` });
                      } catch {
                        toast({ variant: "destructive", title: "Failed to remove alias" });
                      }
                    }}
                  >
                    {removeAliasMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No aliases yet. Add one below.</p>
          )}

          <Separator />

          {/* Add alias form */}
          <form onSubmit={handleAddAlias} className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add new alias</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="alias-email" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Alias email address
                </Label>
                <IconInput
                  id="alias-email"
                  icon={<AtSign className="w-3.5 h-3.5" />}
                  type="email"
                  placeholder="sales@yourdomain.com"
                  value={newAliasEmail}
                  onChange={setNewAliasEmail}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alias-name" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Display name
                </Label>
                <IconInput
                  id="alias-name"
                  icon={<User className="w-3.5 h-3.5" />}
                  type="text"
                  placeholder="Sales Team"
                  value={newAliasName}
                  onChange={setNewAliasName}
                  autoComplete="off"
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={addAliasMut.isPending || !newAliasEmail.trim()}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white border-0"
            >
              {addAliasMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Alias
            </Button>
          </form>
        </div>
      </div>

      {/* Quotation Defaults */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-red-500" />
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Quotation Defaults</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set the default logo and authorized signature/stamp for your PDF quotations.
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-3">
                 <Label>Company Logo</Label>
                 <div className="flex flex-col gap-3">
                   <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                     <div className="flex flex-col items-center justify-center pt-5 pb-6">
                       <ImageIcon className="w-6 h-6 text-muted-foreground mb-2" />
                       <p className="text-xs text-muted-foreground">Upload Logo</p>
                     </div>
                     <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleFileChange(e, "quotation_logo", setLogoDataUrl)} />
                   </label>
                   {logoDataUrl && (
                     <div className="flex items-center gap-4 border rounded-lg p-2 bg-white w-max">
                        <img src={logoDataUrl} alt="Logo preview" className="h-16 w-auto object-contain" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => { localStorage.removeItem('quotation_logo'); setLogoDataUrl(""); }} className="text-destructive hover:text-destructive hover:bg-destructive/10">Clear</Button>
                     </div>
                   )}
                 </div>
               </div>
               
               <div className="space-y-3">
                 <Label>Stamp / Signature</Label>
                 <div className="flex flex-col gap-3">
                   <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                     <div className="flex flex-col items-center justify-center pt-5 pb-6">
                       <ImageIcon className="w-6 h-6 text-muted-foreground mb-2" />
                       <p className="text-xs text-muted-foreground">Upload Stamp</p>
                     </div>
                     <input type="file" className="hidden" accept="image/png, image/jpeg" onChange={(e) => handleFileChange(e, "quotation_stamp", setStampDataUrl)} />
                   </label>
                   {stampDataUrl && (
                     <div className="flex items-center gap-4 border rounded-lg p-2 bg-white w-max">
                        <img src={stampDataUrl} alt="Stamp preview" className="h-16 w-auto object-contain" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => { localStorage.removeItem('quotation_stamp'); setStampDataUrl(""); }} className="text-destructive hover:text-destructive hover:bg-destructive/10">Clear</Button>
                     </div>
                   )}
                 </div>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
}
