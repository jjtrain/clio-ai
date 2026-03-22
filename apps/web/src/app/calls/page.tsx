"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, DollarSign, AlertTriangle, ArrowUpRight, ArrowDownLeft } from "lucide-react";

function fmtDuration(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_BADGE: Record<string, string> = {
  CLS_COMPLETED: "bg-green-100 text-green-700", COMPLETED: "bg-green-100 text-green-700",
  CLS_NO_ANSWER: "bg-gray-100 text-gray-600", NO_ANSWER: "bg-gray-100 text-gray-600",
  CLS_BUSY: "bg-amber-100 text-amber-700", BUSY: "bg-amber-100 text-amber-700",
  CLS_IN_PROGRESS: "bg-blue-100 text-blue-700",
};

const BILLING_BADGE: Record<string, string> = {
  CBS_DRAFT_CREATED: "bg-green-100 text-green-700", CBS_UNBILLED: "bg-amber-100 text-amber-700",
  CBS_NOT_BILLABLE: "bg-gray-100 text-gray-600", CBS_DISMISSED: "bg-gray-100 text-gray-600",
};

function fmt(s: string) { return s.replace(/^(CLS_|CBS_)/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

export default function CallLogPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: stats } = trpc.tapToCall["getStats"].useQuery({ userId: "current-user" });
  const { data: unbilled } = trpc.tapToCall["getUnbilled"].useQuery();
  const { data: callList } = trpc.tapToCall["list"].useQuery({ userId: "current-user" });

  const billAllMut = trpc.tapToCall["billAll"].useMutation({
    onSuccess: (data) => {
      toast({ title: "Billed", description: `Created ${data.count} time entries` });
      utils.tapToCall.invalidate();
    },
  });

  const billOneMut = trpc.tapToCall["createTimeEntry"].useMutation({
    onSuccess: () => { toast({ title: "Time entry created" }); utils.tapToCall.invalidate(); },
  });

  const calls = (callList as any)?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Call Log</h1>
        <p className="text-sm text-slate-500">Track calls, generate billing narratives, and create time entries</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Calls Today</p></div>
            <p className="text-xl font-bold">{stats?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Talk Time Today</p></div>
            <p className="text-xl font-bold">{fmtDuration(stats?.totalDuration ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {(stats?.unbilled ?? 0) > 0 ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <DollarSign className="h-4 w-4 text-green-500" />}
              <p className="text-xs text-slate-500">Unbilled Calls</p>
            </div>
            <p className={`text-xl font-bold ${(stats?.unbilled ?? 0) > 0 ? "text-amber-600" : ""}`}>{stats?.unbilled ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Billed Entries</p></div>
            <p className="text-xl font-bold">{stats?.billed ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Unbilled Alert */}
      {(unbilled?.length ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-amber-800">{unbilled!.length} completed call{unbilled!.length > 1 ? "s" : ""} need billing</span>
          </div>
          <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => billAllMut.mutate()} disabled={billAllMut.isLoading}>
            Bill All
          </Button>
        </div>
      )}

      {/* Recent Calls */}
      <Card>
        <CardHeader><CardTitle>Recent Calls</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {calls.map((call: any) => (
              <Link key={call.id} href={`/calls/${call.id}`} className="flex items-center gap-4 py-3 hover:bg-slate-50 -mx-4 px-4 rounded transition-colors">
                <div className="flex-shrink-0">
                  {call.direction === "OUTBOUND"
                    ? <ArrowUpRight className="h-4 w-4 text-blue-500" />
                    : <ArrowDownLeft className="h-4 w-4 text-green-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{call.contactName ?? "Unknown"}</span>
                    {call.contactRole && <Badge variant="outline" className="text-xs">{fmt(call.contactRole)}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{fmtTime(call.callStarted)}</span>
                    <a href={`tel:${call.contactPhone}`} className="hover:text-blue-600" onClick={e => e.stopPropagation()}>{call.contactPhone}</a>
                    {call.callDuration != null && <span>{fmtDuration(call.callDuration)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={STATUS_BADGE[call.callStatus] ?? "bg-gray-100"}>{fmt(call.callStatus)}</Badge>
                  <Badge className={BILLING_BADGE[call.billingStatus] ?? "bg-gray-100"}>{fmt(call.billingStatus)}</Badge>
                  {call.matter && <span className="text-xs text-slate-500 hidden md:inline">{call.matter.name}</span>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={`tel:${call.contactPhone}`} onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><PhoneOutgoing className="h-3 w-3" /></Button>
                  </a>
                  {call.billingStatus === "CBS_UNBILLED" && call.callStatus === "CLS_COMPLETED" && (
                    <Button variant="ghost" size="sm" className="text-xs h-8" onClick={e => { e.preventDefault(); e.stopPropagation(); billOneMut.mutate({ callLogId: call.id }); }}>
                      Bill
                    </Button>
                  )}
                </div>
              </Link>
            ))}
            {calls.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No calls yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
