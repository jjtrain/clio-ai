"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CalendarDays, Clock, AlertTriangle } from "lucide-react";

export default function ReportsPage() {
  const { data: overview } = trpc.immigration["reports.caseOverview"].useQuery();
  const { data: calendar } = trpc.immigration["reports.deadlineCalendar"].useQuery({});
  const { data: expiry } = trpc.immigration["reports.statusExpiry"].useQuery({ days: 90 });
  const { data: rfeAnalysis } = trpc.immigration["reports.rfeTracker"].useQuery();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <BarChart3 className="h-8 w-8" /> Reports
      </h1>

      <Card>
        <CardHeader><CardTitle>Case Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(overview || []).map((s: any) => (
              <div key={s.status} className="text-center p-3 border rounded-md">
                <p className="text-2xl font-bold">{s._count?.id || 0}</p>
                <Badge variant="outline">{s.status}</Badge>
              </div>
            ))}
          </div>
          {overview && overview.length > 0 && (
            <p className="text-sm text-gray-500 mt-4">Total statuses tracked: {(overview as any[]).reduce((s: number, r: any) => s + (r._count?.id || 0), 0)}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Deadline Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {calendar?.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <div>
                  <span className="font-medium">{d.title}</span>
                  <span className="text-muted-foreground ml-2">{d.beneficiaryName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={d.status === "OVERDUE" ? "destructive" : d.status === "URGENT" ? "destructive" : "secondary"}>
                    {d.status}
                  </Badge>
                  <span>{d.dueDate}</span>
                </div>
              </div>
            ))}
            {!calendar?.length && <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Status Expiry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {expiry?.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <div>
                  <span className="font-medium">{e.beneficiaryName}</span>
                  <Badge variant="outline" className="ml-2">{e.statusType}</Badge>
                </div>
                <span className={e.daysUntilExpiry <= 30 ? "text-destructive font-bold" : ""}>
                  {e.expiryDate} ({e.daysUntilExpiry}d)
                </span>
              </div>
            ))}
            {!expiry?.length && <p className="text-sm text-muted-foreground">No expiring statuses.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> RFE Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rfeAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 border rounded-md">
                  <p className="text-2xl font-bold">{(rfeAnalysis as any[])?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total RFEs</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-2xl font-bold">{(rfeAnalysis as any[])?.filter((c: any) => !c.rfeResponseDate).length || 0}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
                <div className="p-3 border rounded-md">
                  <p className="text-2xl font-bold">{(rfeAnalysis as any[])?.length ? Math.round(((rfeAnalysis as any[]).filter((c: any) => c.rfeResponseDate).length / (rfeAnalysis as any[]).length) * 100) : 0}%</p>
                  <p className="text-sm text-muted-foreground">Response Rate</p>
                </div>
              </div>
              {(rfeAnalysis as any[])?.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Recent RFEs</h4>
                  {(rfeAnalysis as any[]).slice(0, 5).map((c: any) => (
                    <div key={c.id} className="flex justify-between text-sm">
                      <span>{c.beneficiaryName} — {c.caseType}</span><span className="font-bold">{c.rfeDate ? new Date(c.rfeDate).toLocaleDateString() : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
