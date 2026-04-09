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
} from "lucide-react";
import {
  useGetImapStatus,
  useGetWebhookConfig,
  useConfigureImap,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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

function ImapSection() {
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Hostinger Email Integration</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Auto-receive &amp; extract quotation PDFs from your inbox via IMAP polling
            </CardDescription>
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
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {imapLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !isConfigured || showChangeForm ? (
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
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1.5">
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

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={configureMut.isPending || !formEmail || !formPassword}
                className="gap-1.5"
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  extracted and appear in your upload inbox.
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Refresh status
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
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

        <Separator />

        {/* Webhook alternative */}
        <div className="space-y-3">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setWebhookOpen((v) => !v)}
          >
            <Webhook className="w-4 h-4" />
            Alternative: use a webhook endpoint instead
            {webhookOpen ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary ml-1">
              <Zap className="w-2.5 h-2.5 mr-0.5" /> Phase 2
            </Badge>
          </button>

          {webhookOpen && (
            <div className="space-y-3 pl-1">
              {webhookLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : webhookConfig ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    If you prefer push-based delivery, configure Hostinger to pipe raw emails to
                    this URL instead of using IMAP polling.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Hostinger Pipe URL
                      </p>
                      <div className="flex items-center gap-1.5 rounded-md bg-muted border px-3 py-2">
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
                      <div className="flex items-center gap-1.5 rounded-md bg-muted border px-3 py-2">
                        <code className="text-xs text-foreground flex-1 truncate font-mono">
                          {webhookConfig.multipartUrl}
                        </code>
                        <CopyButton text={webhookConfig.multipartUrl} />
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">Configure integrations and application preferences.</p>
      </div>

      <ImapSection />
    </div>
  );
}
