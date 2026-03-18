"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

export default function RFEPage() {
  const { data: allRfes } = trpc.immigration["reports.rfeTracker"].useQuery();
  const active = (allRfes || []).filter((c: any) => !c.rfeResponseDate);
  const past = (allRfes || []).filter((c: any) => c.rfeResponseDate);

  const daysUntil = (date: string) => {
    const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    return d;
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <AlertTriangle className="h-8 w-8" /> RFE Tracker
      </h1>

      <Card className="border-destructive">
        <CardHeader><CardTitle className="text-destructive">Active RFEs</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {active?.length ? active.map((r: any) => {
            const days = daysUntil(r.dueDate);
            return (
              <Link key={r.id} href={`/immigration/cases/${r.caseId}`} className="block">
                <div className="flex items-center justify-between rounded-md border border-destructive/50 p-4 hover:bg-destructive/5">
                  <div>
                    <p className="font-medium">{r.beneficiaryName}</p>
                    <p className="text-sm text-muted-foreground">{r.caseType} &mdash; {r.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className={`text-sm font-bold ${days <= 7 ? "text-destructive" : ""}`}>
                          {days > 0 ? `${days} days left` : "OVERDUE"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Due: {r.dueDate}</p>
                    </div>
                    <Badge variant={r.responseStatus === "DRAFTING" ? "secondary" : "outline"}>
                      {r.responseStatus}
                    </Badge>
                  </div>
                </div>
              </Link>
            );
          }) : <p className="text-sm text-muted-foreground">No active RFEs.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Past RFEs</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {past?.length ? past.map((r: any) => (
            <Link key={r.id} href={`/immigration/cases/${r.caseId}`} className="block">
              <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50">
                <div>
                  <p className="font-medium">{r.beneficiaryName}</p>
                  <p className="text-sm text-muted-foreground">{r.caseType} &mdash; {r.category}</p>
                </div>
                <Badge variant="default">{r.responseStatus}</Badge>
              </div>
            </Link>
          )) : <p className="text-sm text-muted-foreground">No past RFEs.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
