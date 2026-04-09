import { useGetAnalyticsSummary, useGetQuotationsBySupplier, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FileText, Clock, CheckCircle, AlertCircle, TrendingUp, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetAnalyticsSummary();
  const { data: supplierStats, isLoading: isLoadingSuppliers } = useGetQuotationsBySupplier();
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity();

  if (isLoadingSummary || isLoadingSuppliers || isLoadingActivity) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="h-[400px] rounded-xl lg:col-span-4" />
          <Skeleton className="h-[400px] rounded-xl lg:col-span-3" />
        </div>
      </div>
    );
  }

  const pieData = summary?.statusBreakdown.map(item => ({
    name: item.status,
    value: item.count
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your quotation processing pipeline.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <InboxIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalEmails || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Received in inbox
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotations Extracted</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalQuotations || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully processed
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Extraction Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.avgExtractionScore != null ? `${Number(summary.avgExtractionScore).toFixed(1)}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              AI confidence metric
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Action</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.pendingExtraction || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Require manual review
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 flex flex-col">
          <CardHeader>
            <CardTitle>Top Suppliers by Quotation Volume</CardTitle>
            <CardDescription>
              Number of quotations processed per supplier
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {supplierStats && supplierStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierStats.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="supplierName" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="quotationCount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No supplier data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>
              Distribution of quotation statuses
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No status data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {recentActivity?.map((activity, i) => (
              <div key={activity.id} className="flex gap-4 relative">
                {i !== recentActivity.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-border" />
                )}
                <div className="mt-0.5 relative z-10 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border-2 border-background">
                    {activity.type === 'email_received' && <InboxIcon className="w-3 h-3 text-primary" />}
                    {activity.type === 'extraction_complete' && <FileText className="w-3 h-3 text-chart-2" />}
                    {activity.type === 'quotation_reviewed' && <Clock className="w-3 h-3 text-chart-4" />}
                    {activity.type === 'quotation_approved' && <CheckCircle className="w-3 h-3 text-chart-2" />}
                  </div>
                </div>
                <div className="flex flex-col flex-1 pb-1">
                  <div className="text-sm font-medium">{activity.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            ))}
            {(!recentActivity || recentActivity.length === 0) && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No recent activity found.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InboxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
