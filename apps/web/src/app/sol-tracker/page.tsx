"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Plus, Clock, Shield, CheckCircle2, Eye, Database,
} from "lucide-react";

const urgencyStyle = (days: number) => {
  if (days <= 0) return { border: "border-l-red-600", text: "text-red-700", bg: "bg-red-50", label: "EXPIRED" };
  if (days <= 90) return { border: "border-l-red-500", text: "text-red-600", bg: "bg-red-50", label: "CRITICAL" };
  if (days <= 180) return { border: "border-l-amber-500", text: "text-amber-600", bg: "bg-amber-50", label: "WARNING" };
  if (days <= 365) return { border: "border-l-blue-500", text: "text-blue-600", bg: "bg-blue-50", label: "MONITOR" };
  return { border: "border-l-green-500", text: "text-green-600", bg: "bg-green-50", label: "SAFE" };
};

export default function SolDashboardPage() {
  const utils = trpc.useUtils();
  const { data: dashboard } = trpc.sol["reports.dashboard"].useQuery();
  const { data: activeSols } = trpc.sol["list"].useQuery({ status: "SOL_ACTIVE" });
  const seedTemplates = trpc.sol["templates.seed"].useMutation({
    onSuccess: () => utils.sol["templates.list"].invalidate(),
  });
  const markFiled = trpc.sol["markFiled"].useMutation({
    onSuccess: () => {
      utils.sol["reports.dashboard"].invalidate();
      utils.sol["list"].invalidate();
    },
  });

  const bu = (dashboard as any)?.byUrgency ?? {};
  const criticalCount = (bu.SOL_CRITICAL ?? 0) + (bu.SOL_URG_EXPIRED ?? 0);
  const sorted = [...(activeSols ?? [])].sort(
    (a: any, b: any) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
  );

  const statCards = [
    { label: "Critical", value: bu.SOL_CRITICAL ?? 0, bg: "bg-red-50", color: "text-red-700", icon: AlertTriangle },
    { label: "Warning", value: bu.SOL_WARNING ?? 0, bg: "bg-amber-50", color: "text-amber-700", icon: Clock },
    { label: "Monitor", value: bu.SOL_MONITOR ?? 0, bg: "bg-blue-50", color: "text-blue-700", icon: Eye },
    { label: "Safe", value: bu.SOL_SAFE ?? 0, bg: "bg-green-50", color: "text-green-700", icon: Shield },
    { label: "Filed This Month", value: (dashboard as any)?.byStatus?.SOL_FILED ?? 0, bg: "bg-white", color: "text-gray-900", icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {criticalCount > 0 && (
        <Link href="/sol-tracker?filter=critical"
          className="block bg-red-600 text-white rounded-xl px-5 py-3 font-medium hover:bg-red-700 transition-colors">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          {criticalCount} statutes of limitations require immediate attention
        </Link>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SOL Tracker</h1>
          <p className="text-gray-500">Monitor statutes of limitations across all matters</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedTemplates.mutate()} disabled={seedTemplates.isPending}>
            <Database className="h-4 w-4 mr-2" />Seed Templates
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link href="/sol-tracker/new"><Plus className="h-4 w-4 mr-2" />New SOL</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 shadow-sm p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Expiring Soon</h2>
        {!sorted.length ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
            No active statutes of limitations
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((sol) => {
              const days = Math.ceil(
                (new Date(sol.expirationDate).getTime() - Date.now()) / 86400000
              );
              const u = urgencyStyle(days);
              return (
                <div key={sol.id}
                  className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 border-l-4 ${u.border} flex items-center gap-4`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{(sol as any).matter?.name ?? "—"}</p>
                    <p className="text-sm text-gray-500">{sol.causeOfAction}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{sol.jurisdiction}</Badge>
                      <span className="text-xs text-gray-400">Assigned: {sol.assignedTo ?? "—"}</span>
                      <Badge className={`text-[10px] ${u.bg} ${u.text} border-0`}>{sol.status}</Badge>
                    </div>
                  </div>
                  <div className="text-center px-4">
                    <p className={`text-3xl font-bold ${u.text}`}>
                      {days <= 0 ? `${Math.abs(days)}` : days}
                    </p>
                    <p className={`text-xs ${u.text}`}>{days <= 0 ? "days overdue" : "days left"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Expires</p>
                    <p className="text-sm font-medium">{new Date(sol.expirationDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm"
                      onClick={() => markFiled.mutate({ id: sol.id, filedDate: new Date().toISOString() })}
                      disabled={markFiled.isPending}>
                      Mark Filed
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/sol-tracker/${sol.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
