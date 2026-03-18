"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, AlertTriangle } from "lucide-react";
import Link from "next/link";

const types = ["All", "FILING", "RFE_RESPONSE", "STATUS_EXPIRY", "BIOMETRICS", "INTERVIEW", "OTHER"];
const statuses = ["All", "PENDING", "WARNING", "URGENT", "OVERDUE", "COMPLETED"];

export default function DeadlinesPage() {
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");

  const { data: deadlines } = trpc.immigration["deadlines.list"].useQuery({
    deadlineType: type !== "All" ? type : undefined,
    status: status !== "All" ? status : undefined,
  });

  const urgent = deadlines?.filter((d: any) => d.status === "OVERDUE" || d.status === "URGENT") ?? [];
  const rest = deadlines?.filter((d: any) => d.status !== "OVERDUE" && d.status !== "URGENT") ?? [];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <CalendarDays className="h-8 w-8" /> Deadlines
      </h1>

      <div className="flex gap-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t === "All" ? "All Types" : t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {urgent.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Urgent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {urgent.map((d: any) => (
              <Link key={d.id} href={`/immigration/cases/${d.caseId}`} className="block">
                <div className="flex items-center justify-between rounded-md border border-destructive/50 p-3 hover:bg-destructive/5">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-sm text-muted-foreground">{d.beneficiaryName} &mdash; {d.caseType}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">{d.status}</Badge>
                    <p className="text-sm mt-1">{d.dueDate}</p>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>All Deadlines</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rest.map((d: any) => (
            <Link key={d.id} href={`/immigration/cases/${d.caseId}`} className="block">
              <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-sm text-muted-foreground">{d.beneficiaryName} &mdash; {d.caseType}</p>
                </div>
                <div className="text-right">
                  <Badge variant={d.status === "COMPLETED" ? "default" : d.status === "WARNING" ? "secondary" : "outline"}>
                    {d.status}
                  </Badge>
                  <p className="text-sm mt-1">{d.dueDate}</p>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
