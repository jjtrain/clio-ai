"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Mail, Send, Inbox, HelpCircle } from "lucide-react";

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function ReportsPage() {
  const stats = trpc.email["reports.volume"].useQuery({ dateFrom: new Date(Date.now() - 30 * 86400000).toISOString(), dateTo: new Date().toISOString() });
  const perMatter = trpc.email["reports.byMatter"].useQuery();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Email Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of email activity</p>
      </div>

      {stats.isLoading && <p className="text-muted-foreground">Loading...</p>}

      {stats.data && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Received" value={(stats.data as any)?.inbound ?? 0} icon={Inbox} />
          <StatCard label="Sent" value={(stats.data as any)?.outbound ?? 0} icon={Send} />
          <StatCard label="Total" value={(stats.data as any)?.total ?? 0} icon={Mail} />
          <StatCard label="Period" value={0} icon={HelpCircle} />
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Emails per Matter</h2>
        {perMatter.isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}
        {perMatter.data?.length === 0 && !perMatter.isLoading && (
          <p className="text-muted-foreground text-sm">No data yet.</p>
        )}
        <div className="space-y-2">
          {perMatter.data?.map((item: any) => {
            const max = Math.max(...(perMatter.data?.map((d: any) => d.count) || [1]));
            const pct = Math.round((item.count / max) * 100);
            return (
              <div key={item.matterId} className="flex items-center gap-3">
                <span className="text-sm w-48 truncate">{item.matterName || item.matterId}</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {item.count}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
