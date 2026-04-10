import { useMemo } from "react";
import { useGetAnalyticsSummary, useGetQuotationsBySupplier, useGetRecentActivity } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadialBarChart, RadialBar,
  CartesianGrid, ReferenceLine,
} from "recharts";
import {
  FileText, Clock, CheckCircle, TrendingUp, Activity,
  Mail, BarChart2, Zap, AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

const BAR_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const STATUS_COLORS: Record<string, string> = {
  draft: "#6366f1",
  reviewed: "#06b6d4",
  approved: "#10b981",
  rejected: "#ef4444",
};

const RADIAL_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];

const CARD_STYLES = [
  { gradient: "from-indigo-500 to-blue-600", icon: "bg-white/20 text-white", text: "text-white", sub: "text-indigo-100" },
  { gradient: "from-emerald-500 to-teal-600", icon: "bg-white/20 text-white", text: "text-white", sub: "text-emerald-100" },
  { gradient: "from-violet-500 to-purple-600", icon: "bg-white/20 text-white", text: "text-white", sub: "text-violet-100" },
  { gradient: "from-orange-500 to-amber-500", icon: "bg-white/20 text-white", text: "text-white", sub: "text-orange-100" },
];

interface MonthlyPoint { month: string; count: number; totalValue: number; }
interface CurrencyPoint { currency: string; count: number; totalValue: number; }

function StatCard({
  title, value, sub, icon: Icon, style, href,
}: { title: string; value: string | number; sub: string; icon: React.ElementType; style: typeof CARD_STYLES[0]; href: string }) {
  return (
    <Link href={href} className="block">
      <Card className={`bg-gradient-to-br ${style.gradient} border-0 shadow-lg hover-elevate cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`text-sm font-medium ${style.sub}`}>{title}</CardTitle>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${style.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${style.text}`}>{value}</div>
          <p className={`text-xs mt-1 ${style.sub}`}>{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card, #fff)",
    borderColor: "var(--border, #e2e8f0)",
    borderRadius: "10px",
    fontSize: "12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  },
};

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetAnalyticsSummary();
  const { data: supplierStats, isLoading: isLoadingSuppliers } = useGetQuotationsBySupplier();
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: monthlyTrend } = useQuery<MonthlyPoint[]>({
    queryKey: ["analytics/monthly-trend"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/monthly-trend");
      return res.json();
    },
    staleTime: 60_000,
  });
  const { data: currencyData } = useQuery<CurrencyPoint[]>({
    queryKey: ["analytics/currency-breakdown"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/currency-breakdown");
      return res.json();
    },
    staleTime: 60_000,
  });

  const pieData = useMemo(() =>
    summary?.statusBreakdown.map(item => ({
      name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
      value: item.count,
      fill: STATUS_COLORS[item.status] ?? "#94a3b8",
    })) ?? [],
  [summary]);

  const coloredSuppliers = useMemo(() =>
    (supplierStats ?? []).slice(0, 8).map((s, i) => ({
      ...s,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    })),
  [supplierStats]);

  const normalizedRadial = useMemo(() => {
    const radialData = (currencyData ?? []).slice(0, 5).map((c, i) => ({
      name: c.currency,
      value: c.totalValue > 0 ? c.totalValue : c.count * 100,
      count: c.count,
      fill: RADIAL_COLORS[i % RADIAL_COLORS.length],
    }));
    const maxRadial = Math.max(...radialData.map((r) => r.value), 1);
    return radialData.map((r) => ({ ...r, displayValue: Math.round((r.value / maxRadial) * 100) }));
  }, [currencyData]);

  if (isLoadingSummary || isLoadingSuppliers || isLoadingActivity) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[300px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your quotation processing pipeline.</p>
      </div>

      {/* ── Stat Cards ─────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Emails"
          value={summary?.totalEmails ?? 0}
          sub="Received in inbox"
          icon={Mail}
          style={CARD_STYLES[0]}
          href="/mail"
        />
        <StatCard
          title="Quotations Extracted"
          value={summary?.totalQuotations ?? 0}
          sub="Successfully processed"
          icon={FileText}
          style={CARD_STYLES[1]}
          href="/quotations"
        />
        <StatCard
          title="AI Confidence"
          value={summary?.avgExtractionScore != null ? `${Number(summary.avgExtractionScore).toFixed(1)}%` : "N/A"}
          sub="Avg extraction score"
          icon={Zap}
          style={CARD_STYLES[2]}
          href="/quotations"
        />
        <StatCard
          title="Pending Action"
          value={summary?.pendingExtraction ?? 0}
          sub="Require manual review"
          icon={Clock}
          style={CARD_STYLES[3]}
          href="/inbox"
        />
      </div>

      {/* ── Row 2: Area chart + Donut ───────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Trend — Area Chart */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base">Monthly Trend</CardTitle>
                <CardDescription>Quotations processed per month</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[220px]">
            {monthlyTrend && monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDraft" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="approved" name="Approved" stackId="1" stroke="#10b981" strokeWidth={2} fill="url(#gradApproved)" />
                  <Area type="monotone" dataKey="draft" name="Draft" stackId="1" stroke="#6366f1" strokeWidth={2} fill="url(#gradDraft)" />
                  <Area type="monotone" dataKey="rejected" name="Rejected" stackId="1" stroke="#ef4444" strokeWidth={2} fill="url(#gradRejected)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart2 className="w-10 h-10 opacity-20" />
                <p className="text-sm">No trend data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown — Donut with legend */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">Status Breakdown</CardTitle>
                <CardDescription>Distribution of quotation statuses</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[220px] flex items-center">
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4 w-full">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.fill }} />
                        <span className="text-sm text-foreground capitalize">{item.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-bold px-2">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <AlertCircle className="w-10 h-10 opacity-20" />
                <p className="text-sm">No status data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Multi-color Bar + Radial Bar ────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top Customers — Multi-colored Bar Chart */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-base">Top Customers</CardTitle>
                <CardDescription>Quotations processed per customer</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[260px]">
            {coloredSuppliers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coloredSuppliers} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
                  <XAxis
                    dataKey="supplierName"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                  <Bar dataKey="quotationCount" radius={[6, 6, 0, 0]} name="Quotations">
                    {coloredSuppliers.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart2 className="w-10 h-10 opacity-20" />
                <p className="text-sm">No customer data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Currency Breakdown — Radial Bar */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">By Currency</CardTitle>
                <CardDescription>Quotation value split</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-[260px] flex flex-col">
            {normalizedRadial.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={80}
                    barSize={12}
                    data={normalizedRadial}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar dataKey="displayValue" background={{ fill: "hsl(var(--muted))" }} cornerRadius={6} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={tooltipStyle.contentStyle} className="px-3 py-2">
                            <p className="font-semibold text-xs">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.count} quotation{d.count !== 1 ? "s" : ""}</p>
                            {d.value > 0 && <p className="text-xs text-muted-foreground">{d.value.toLocaleString()} total</p>}
                          </div>
                        );
                      }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {normalizedRadial.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.fill }} />
                        <span className="font-medium text-foreground">{item.name}</span>
                      </div>
                      <span className="text-muted-foreground">{item.count} qtns</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <TrendingUp className="w-10 h-10 opacity-20" />
                <p className="text-sm">No currency data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
              <Activity className="w-4 h-4 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest quotation events</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity?.slice(0, 8).map((activity, i) => {
              const isApproved = activity.type === "quotation_approved";
              const isReviewed = activity.type === "quotation_reviewed";
              const dotColor = isApproved ? "bg-emerald-500" : isReviewed ? "bg-cyan-500" : "bg-indigo-500";
              const iconBg = isApproved ? "bg-emerald-100 dark:bg-emerald-900" : isReviewed ? "bg-cyan-100 dark:bg-cyan-900" : "bg-indigo-100 dark:bg-indigo-900";
              const iconColor = isApproved ? "text-emerald-600 dark:text-emerald-300" : isReviewed ? "text-cyan-600 dark:text-cyan-300" : "text-indigo-600 dark:text-indigo-300";
              const IconEl = isApproved ? CheckCircle : isReviewed ? Clock : FileText;
              return (
                <div key={activity.id} className="flex gap-3 relative">
                  {i !== (recentActivity?.slice(0, 8).length ?? 0) - 1 && (
                    <div className="absolute left-[15px] top-7 bottom-[-16px] w-px bg-border" />
                  )}
                  <div className={`mt-0.5 relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                    <IconEl className={`w-3.5 h-3.5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(activity.timestamp), "MMM d, h:mm a")}
                    </p>
                  </div>
                  {activity.quotationId && (
                    <Link
                      href={`/quotations/${activity.quotationId}`}
                      className="shrink-0 text-xs text-primary hover:underline self-center"
                    >
                      View
                    </Link>
                  )}
                </div>
              );
            })}
            {(!recentActivity || recentActivity.length === 0) && (
              <div className="text-sm text-muted-foreground py-6 text-center flex flex-col items-center gap-2">
                <Activity className="w-8 h-8 opacity-20" />
                No recent activity found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
