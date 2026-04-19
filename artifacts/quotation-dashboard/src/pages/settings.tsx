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
  getGetImapStatusQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Image as ImageIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  // Hostinger default server settings
  const HOSTINGER_IMAP_HOST = "imap.hostinger.com";
  const HOSTINGER_SMTP_HOST = "smtp.hostinger.com";

  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("");
  const [imapHost, setImapHost] = useState(HOSTINGER_IMAP_HOST);
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState(HOSTINGER_SMTP_HOST);
  const [smtpPort, setSmtpPort] = useState(465);
  const [showForm, setShowForm] = useState(false);

  // Just update the email; Hostinger server fields stay pre-filled (user can override)
  const handleEmailChange = (val: string) => {
    setEmail(val);
  };

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

  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ["mail-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/mail-accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json() as Promise<any[]>;
    },
  });

  const { data: statuses } = useQuery({
    queryKey: ["mail-accounts-status"],
    queryFn: async () => {
      const res = await fetch("/api/mail-accounts/status");
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json() as Promise<any[]>;
    },
    refetchInterval: 10_000,
  });

  function getStatusForAccount(id: number) {
    return (statuses || []).find(s => s.id === id);
  }

  const configureAccountMut = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/mail-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mail-accounts"] }); }
  });

  const deleteAccountMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mail-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mail-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["mail-accounts-status"] });
      toast({ title: "Account removed", description: "Mail account has been disconnected." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Delete failed", description: "Could not remove the account. Please try again." });
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

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !label) return;
    try {
      await configureAccountMut.mutateAsync({
        label,
        email,
        password,
        imapHost: imapHost || `imap.${email.split('@')[1]}`,
        imapPort,
        smtpHost: smtpHost || `smtp.${email.split('@')[1]}`,
        smtpPort,
        fromName,
      });
      toast({ title: "Account connected", description: "IMAP polling and SMTP sending are now active for this account." });
      setPassword("");
      setEmail("");
      setLabel("");
      setFromName("");
      setImapHost(HOSTINGER_IMAP_HOST);
      setSmtpHost(HOSTINGER_SMTP_HOST);
      setImapPort(993);
      setSmtpPort(465);
      setShowForm(false);
      refetchAccounts();
    } catch {
      toast({ variant: "destructive", title: "Connection failed", description: "Could not sync account. Check your email and password." });
    }
  };

  const isPending = configureAccountMut.isPending;
  const isAnyConfigured = accounts && accounts.length > 0;
  const showCredentialForm = !isAnyConfigured || showForm;

  return (
    <TooltipProvider>
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

      {/* Multi-Account Email Card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-blue-500 via-cyan-400 via-teal-400 to-emerald-500" />

        {/* Card header */}
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Mail Accounts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage multiple connected mailboxes for incoming & outgoing sync</p>
            </div>
          </div>
          {!showCredentialForm && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-lg"
              onClick={() => { setEmail(""); setPassword(""); setLabel(""); setShowForm(true); }}>
              <Plus className="w-3 h-3" /> Add account
            </Button>
          )}
        </div>

        <div className="px-6 py-5 border-b border-border">
          {accountsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts...
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((acc: any) => (
                <div key={acc.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full border border-border/80 bg-background flex items-center justify-center shrink-0">
                       <Mail className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                     </div>
                     <div>
                       <p className="font-semibold text-sm">{acc.label}</p>
                       <p className="text-xs text-muted-foreground">{acc.email}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-4">
                     {(() => {
                        const s = getStatusForAccount(acc.id);
                        if (!s) return null;
                        if (s.connected) {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Connected
                            </span>
                          );
                        }
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25 cursor-help">
                                <AlertCircle className="w-3 h-3" /> Connection error
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {s.lastError || "Check your credentials"}
                            </TooltipContent>
                          </Tooltip>
                        );
                     })()}
                     <button
                       type="button"
                       disabled={deleteAccountMut.isPending}
                       onClick={async () => {
                         if (!window.confirm(`Remove "${acc.label}" (${acc.email})?`)) return;
                         deleteAccountMut.mutate(acc.id);
                       }}
                       className="p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 rounded-md transition-colors disabled:opacity-50"
                     >
                       {deleteAccountMut.isPending && deleteAccountMut.variables === acc.id
                         ? <Loader2 className="w-4 h-4 animate-spin" />
                         : <Trash2 className="w-4 h-4" />}
                     </button>
                   </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <WifiOff className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No accounts connected</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">Connect a Google Workspace or Hostinger email to sync quotations automatically.</p>
            </div>
          )}
        </div>

        {/* Credentials Form */}
        {showCredentialForm && (
          <form onSubmit={handleSaveAccount} className="p-6 bg-muted/10 border-b border-border">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground">
              <KeyRound className="w-4 h-4 text-violet-500" /> Connect new account
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="label" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">Account Label</Label>
                <IconInput id="label" icon={<Tag className="w-3.5 h-3.5" />} placeholder="e.g. Sales Team Inbox" value={label} onChange={setLabel} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">Email address</Label>
                <IconInput id="email" type="email" icon={<User className="w-3.5 h-3.5" />} placeholder="info@company.com" value={email} onChange={handleEmailChange} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">App Password</Label>
                <IconInput id="password" type="password" icon={<Lock className="w-3.5 h-3.5" />} placeholder="••••••••••••••••" value={password} onChange={setPassword} required autoComplete="current-password" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="fromName" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">Sender Display Name (Optional)</Label>
                <IconInput id="fromName" icon={<User className="w-3.5 h-3.5" />} placeholder="e.g. John Doe" value={fromName} onChange={setFromName} />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-violet-500 pl-2 flex items-center gap-2">
                    Incoming (IMAP)
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20 normal-case tracking-normal">Hostinger</span>
                  </h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="imapHost" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">IMAP Host</Label>
                    <IconInput id="imapHost" icon={<Server className="w-3.5 h-3.5" />} placeholder="imap.hostinger.com" value={imapHost} onChange={setImapHost} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="imapPort" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">IMAP Port</Label>
                    <Input id="imapPort" type="number" value={imapPort} onChange={e => setImapPort(parseInt(e.target.value))} className="text-sm" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-blue-500 pl-2 flex items-center gap-2">
                    Outgoing (SMTP)
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 normal-case tracking-normal">Hostinger</span>
                  </h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtpHost" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">SMTP Host</Label>
                    <IconInput id="smtpHost" icon={<Send className="w-3.5 h-3.5" />} placeholder="smtp.hostinger.com" value={smtpHost} onChange={setSmtpHost} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtpPort" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide ml-1">SMTP Port</Label>
                    <Input id="smtpPort" type="number" value={smtpPort} onChange={e => setSmtpPort(parseInt(e.target.value))} className="text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              {accounts && accounts.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              )}
              <Button type="submit" size="sm" disabled={isPending} className="gap-2 shrink-0 bg-violet-600 hover:bg-violet-700 text-white">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                Connect Account
              </Button>
            </div>
          </form>
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
    </TooltipProvider>
  );
}
