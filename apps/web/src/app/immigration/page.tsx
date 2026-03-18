"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Briefcase, AlertTriangle, Clock, FileText, CalendarDays,
  CheckCircle, ArrowRight, Activity,
} from "lucide-react";

export default function ImmigrationDashboard() {
  const { data: stats } = trpc.immigration["reports.caseOverview"].useQuery();
  const { data: alerts } = trpc.immigration["deadlines.getUrgent"].useQuery();
  const { data: cases } = trpc.immigration["cases.list"].useQuery({});

  const activeCases = (cases || []).length;
  const pendingRFEs = (cases || []).filter((c: any) => c.status === "RFE_ISSUED").length;
  const approved = (cases || []).filter((c: any) => c.status === "APPROVED").length;
  const urgentCount = (alerts || []).length;

  const statCards = [
    { label: "Active Cases", value: activeCases, icon: Briefcase, href: "/immigration/cases" },
    { label: "Pending RFEs", value: pendingRFEs, icon: AlertTriangle, href: "/immigration/rfe" },
    { label: "Urgent Deadlines", value: urgentCount, icon: Clock, href: "/immigration/deadlines" },
    { label: "Approved", value: approved, icon: CheckCircle, href: "/immigration/reports" },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Immigration Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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

      {alerts && alerts.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Urgent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
                <Badge variant={a.type === "RFE" ? "destructive" : "secondary"}>
                  {a.type}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Recent Activities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(alerts || []).slice(0, 10).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
              <span>{a.title}</span>
              <span className="text-muted-foreground">{new Date(a.dueDate).toLocaleDateString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "New Case", href: "/immigration/cases/new" },
          { label: "Visa Bulletin", href: "/immigration/visa-bulletin" },
          { label: "Reports", href: "/immigration/reports" },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <Button variant="outline" className="w-full justify-between">
              {link.label} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
