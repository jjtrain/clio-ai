"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Building2, CalendarDays, DollarSign, AlertTriangle,
  CheckCircle, ArrowRight, Activity, Clock, BarChart3,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Intake",
  CONTRACT_REVIEW: "Contract Review",
  DUE_DILIGENCE: "Due Diligence",
  TITLE_SEARCH: "Title Search",
  TITLE_CLEARANCE: "Title Clearance",
  MORTGAGE_PROCESSING: "Mortgage Processing",
  SURVEY: "Survey",
  INSPECTIONS: "Inspections",
  CLOSING_PREP: "Closing Prep",
  CLOSING_SCHEDULED: "Closing Scheduled",
  CLOSED: "Closed",
  POST_CLOSING: "Post-Closing",
  RECORDED: "Recorded",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function ConveyancingDashboard() {
  const { data: matters } = trpc.conveyancing["matters.list"].useQuery({});
  const titleExceptions: any[] = [];

  const all = (matters as any)?.items || matters || [];
  const active = all.filter((c: any) => !["COMPLETED", "CANCELLED", "RECORDED"].includes(c.status));
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const closingThisMonth = all.filter(
    (c: any) => c.closingDate && new Date(c.closingDate) >= now && new Date(c.closingDate) <= endOfMonth
  );
  const totalVolume = all.reduce(
    (sum: number, c: any) => sum + (parseFloat(c.purchasePrice || c.salePrice || "0")),
    0
  );
  const openExceptions = ((titleExceptions as any)?.items || titleExceptions || []).filter(
    (te: any) => te.status === "OPEN" || te.status === "IN_PROGRESS"
  );
  const avgChecklist = (() => {
    const withChecklists = all.filter((c: any) => c.checklists?.length);
    if (!withChecklists.length) return 0;
    const total = withChecklists.reduce((sum: number, c: any) => {
      const avg = c.checklists.reduce(
        (s: number, cl: any) => s + (parseFloat(cl.completionPercentage || "0")),
        0
      ) / c.checklists.length;
      return sum + avg;
    }, 0);
    return Math.round(total / withChecklists.length);
  })();

  const statCards = [
    { label: "Active Transactions", value: active.length, icon: Building2, href: "/conveyancing/matters" },
    { label: "Closing This Month", value: closingThisMonth.length, icon: CalendarDays, href: "/conveyancing/closings" },
    { label: "Total Volume", value: `$${(totalVolume / 1000000).toFixed(1)}M`, icon: DollarSign, href: "/conveyancing/matters" },
    { label: "Open Title Exceptions", value: openExceptions.length, icon: AlertTriangle, href: "/conveyancing/matters" },
    { label: "Avg Checklist Completion", value: `${avgChecklist}%`, icon: CheckCircle, href: "/conveyancing/matters" },
  ];

  // Pipeline status counts
  const pipeline = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({
      status: key,
      label,
      count: all.filter((c: any) => c.status === key).length,
    }))
    .filter((p) => p.count > 0);

  // Upcoming closings (next 30 days)
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000);
  const upcoming = all
    .filter(
      (c: any) =>
        c.closingDate &&
        new Date(c.closingDate) >= now &&
        new Date(c.closingDate) <= thirtyDaysOut &&
        !["COMPLETED", "CANCELLED", "RECORDED"].includes(c.status)
    )
    .sort((a: any, b: any) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime())
    .slice(0, 10);

  // Needs attention: open title exceptions or low checklist completion
  const needsAttention = active.filter((c: any) => {
    const hasOpenExceptions = c.titleExceptions?.some(
      (te: any) => te.status === "OPEN" || te.status === "IN_PROGRESS"
    );
    const lowChecklist = c.checklists?.some(
      (cl: any) => parseFloat(cl.completionPercentage || "0") < 50
    );
    return hasOpenExceptions || lowChecklist;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Conveyancing Dashboard</h1>
        <Link href="/conveyancing/matters/new">
          <Button>New Transaction</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {pipeline.map((p) => (
              <div key={p.status} className="flex items-center gap-2 rounded-md border p-3">
                <span className="text-sm font-medium">{p.label}</span>
                <Badge variant="secondary">{p.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> Upcoming Closings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming closings in the next 30 days.</p>
            )}
            {upcoming.map((c: any) => (
              <Link key={c.id} href={`/conveyancing/matters/${c.id}`}>
                <div className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors">
                  <div>
                    <p className="font-medium">{c.propertyAddress}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.matter?.name} &middot; {new Date(c.closingDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{STATUS_LABELS[c.status] || c.status}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className={needsAttention.length > 0 ? "border-destructive" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsAttention.length === 0 && (
              <p className="text-sm text-muted-foreground">All transactions are on track.</p>
            )}
            {needsAttention.slice(0, 10).map((c: any) => {
              const openTe = c.titleExceptions?.filter(
                (te: any) => te.status === "OPEN" || te.status === "IN_PROGRESS"
              ).length || 0;
              return (
                <Link key={c.id} href={`/conveyancing/matters/${c.id}`}>
                  <div className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors">
                    <div>
                      <p className="font-medium">{c.propertyAddress}</p>
                      <p className="text-sm text-muted-foreground">{c.matter?.name}</p>
                    </div>
                    <div className="flex gap-2">
                      {openTe > 0 && <Badge variant="destructive">{openTe} exceptions</Badge>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
