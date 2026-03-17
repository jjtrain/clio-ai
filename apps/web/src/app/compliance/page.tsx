"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, ShieldCheck, ShieldAlert, AlertTriangle, AlertCircle, Clock,
  Users, CheckCircle, XCircle, RefreshCw, ArrowRight, Eye, Bell,
} from "lucide-react";

const RISK_COLORS: Record<string, string> = { LOW: "bg-emerald-100 text-emerald-700", MEDIUM: "bg-blue-100 text-blue-700", HIGH: "bg-amber-100 text-amber-700", VERY_HIGH: "bg-red-100 text-red-700", PROHIBITED: "bg-red-200 text-red-800" };
const STATUS_COLORS: Record<string, string> = { NOT_STARTED: "bg-gray-100 text-gray-700", PENDING_CLIENT: "bg-amber-100 text-amber-700", IN_PROGRESS: "bg-blue-100 text-blue-700", AWAITING_DOCUMENTS: "bg-purple-100 text-purple-700", UNDER_REVIEW: "bg-indigo-100 text-indigo-700", PASSED: "bg-emerald-100 text-emerald-700", FAILED: "bg-red-100 text-red-700", REFERRED: "bg-orange-100 text-orange-700", EXPIRED: "bg-gray-100 text-gray-500", CANCELLED: "bg-gray-100 text-gray-400" };

export default function ComplianceDashboard() {
  const { toast } = useToast();
  const { data: dashboard, isLoading } = trpc.compliance["reports.dashboard"].useQuery();
  const { data: needsReview } = trpc.compliance["checks.list"].useQuery({ status: "UNDER_REVIEW" });
  const { data: expiring } = trpc.compliance["reports.expiring"].useQuery({ days: 30 });
  const { data: pendingClient } = trpc.compliance["checks.list"].useQuery({ status: "PENDING_CLIENT" });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance</h1>
          <p className="text-sm text-slate-500">KYC/AML compliance, client verification, and risk monitoring</p>
        </div>
        <Link href="/compliance/checks/new"><Button><ShieldCheck className="h-4 w-4 mr-2" /> New Check</Button></Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-emerald-600">{dashboard ? Math.round(((dashboard.byStatus?.find((s: any) => s.status === "PASSED")?._count || 0) / Math.max(dashboard.total, 1)) * 100) : 0}%</p>
            <p className="text-xs text-gray-500">Compliance Rate</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-amber-600">{dashboard?.pendingReview || 0}</p>
            <p className="text-xs text-gray-500">Pending Review</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-red-600">{dashboard?.byRisk?.filter((r: any) => r.overallRiskLevel === "HIGH" || r.overallRiskLevel === "VERY_HIGH").reduce((s: number, r: any) => s + r._count, 0) || 0}</p>
            <p className="text-xs text-gray-500">High Risk</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-purple-600">{dashboard?.expiringSoon || 0}</p>
            <p className="text-xs text-gray-500">Expiring (30d)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{dashboard?.total || 0}</p>
            <p className="text-xs text-gray-500">Total Checks</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-400">
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{dashboard?.expired || 0}</p>
            <p className="text-xs text-gray-500">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      {dashboard?.byRisk && dashboard.byRisk.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {dashboard.byRisk.map((r: any) => (
                <div key={r.overallRiskLevel} className={`flex-1 rounded-lg p-3 text-center ${RISK_COLORS[r.overallRiskLevel] || "bg-gray-100"}`}>
                  <p className="text-xl font-bold">{r._count}</p>
                  <p className="text-xs">{r.overallRiskLevel?.replace("_", " ") || "Unknown"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Awaiting Review */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Awaiting Review ({(needsReview || []).length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(needsReview || []).slice(0, 5).map((check: any) => (
              <Link key={check.id} href={`/compliance/checks/${check.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:border-blue-300 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{check.subjectName}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[check.overallRiskLevel] || ""}`}>{check.overallRiskLevel || "—"}</span>
                      <span className="text-xs text-gray-500">{check.checkType}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300" />
                </div>
              </Link>
            ))}
            {(!needsReview || needsReview.length === 0) && <p className="text-center text-gray-400 py-4">No checks awaiting review.</p>}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Expiring Soon ({(expiring || []).length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(expiring || []).slice(0, 5).map((check: any) => (
              <Link key={check.id} href={`/compliance/checks/${check.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:border-amber-300 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{check.subjectName || check.client?.name}</p>
                    <p className="text-xs text-gray-500">Expires: {check.expiresAt ? new Date(check.expiresAt).toLocaleDateString() : "—"}</p>
                  </div>
                  <Clock className="h-4 w-4 text-amber-400" />
                </div>
              </Link>
            ))}
            {(!expiring || expiring.length === 0) && <p className="text-center text-gray-400 py-4">No checks expiring soon.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Pending Client */}
      {pendingClient && pendingClient.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Pending Client Action ({pendingClient.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingClient.slice(0, 5).map((check: any) => (
              <div key={check.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">{check.subjectName}</p>
                  <p className="text-xs text-gray-500">{check.client?.name} · Waiting for documents</p>
                </div>
                <Link href={`/compliance/checks/${check.id}`}><Button size="sm" variant="outline">View</Button></Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { name: "All Checks", href: "/compliance/checks", icon: ShieldCheck },
          { name: "New Check", href: "/compliance/checks/new", icon: ShieldAlert },
          { name: "Policies", href: "/compliance/policies", icon: Users },
          { name: "Monitoring", href: "/compliance/monitoring", icon: Bell },
          { name: "Risk Register", href: "/compliance/risk-register", icon: AlertTriangle },
          { name: "Reports", href: "/compliance/reports", icon: Clock },
        ].map((link) => (
          <Link key={link.name} href={link.href}>
            <Card className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="pt-6 text-center">
                <link.icon className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                <p className="text-xs font-medium">{link.name}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
