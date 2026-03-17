"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const RISK_COLORS: Record<string, string> = { LOW: "bg-emerald-100 text-emerald-700", MEDIUM: "bg-blue-100 text-blue-700", HIGH: "bg-amber-100 text-amber-700", VERY_HIGH: "bg-red-100 text-red-700" };
const STATUS_COLORS: Record<string, string> = { PASSED: "bg-emerald-100 text-emerald-700", FAILED: "bg-red-100 text-red-700", EXPIRED: "bg-gray-100 text-gray-500", PENDING_CLIENT: "bg-amber-100 text-amber-700", IN_PROGRESS: "bg-blue-100 text-blue-700", UNDER_REVIEW: "bg-indigo-100 text-indigo-700" };
const ROW_COLORS: Record<string, string> = { LOW: "", MEDIUM: "", HIGH: "bg-amber-50", VERY_HIGH: "bg-red-50" };

export default function RiskRegisterPage() {
  const { data: register, isLoading } = trpc.compliance["reports.clientRiskRegister"].useQuery();

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Client Risk Register</h1><p className="text-sm text-slate-500">Comprehensive compliance status for all clients</p></div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-gray-500">Client</th>
                  <th className="pb-2 font-medium text-gray-500">Subject Type</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Risk Level</th>
                  <th className="pb-2 font-medium text-gray-500 text-right">Score</th>
                  <th className="pb-2 font-medium text-gray-500">Last Check</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Status</th>
                  <th className="pb-2 font-medium text-gray-500">Expires</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Monitoring</th>
                </tr>
              </thead>
              <tbody>
                {(register || []).map((r: any) => (
                  <tr key={r.id} className={`border-b last:border-0 ${ROW_COLORS[r.overallRiskLevel] || ""}`}>
                    <td className="py-3"><Link href={`/compliance/checks/${r.id}`} className="font-medium text-blue-600 hover:underline">{r.subjectName || r.client?.name}</Link></td>
                    <td className="py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{r.subjectType}</span></td>
                    <td className="py-3 text-center">{r.overallRiskLevel ? <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[r.overallRiskLevel]}`}>{r.overallRiskLevel}</span> : "—"}</td>
                    <td className="py-3 text-right">{r.riskScore ?? "—"}</td>
                    <td className="py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>{r.status.replace(/_/g, " ")}</span></td>
                    <td className="py-3 text-gray-500">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</td>
                    <td className="py-3 text-center">{r.ongoingMonitoringId ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active</span> : "—"}</td>
                  </tr>
                ))}
                {(!register || register.length === 0) && <tr><td colSpan={8} className="py-8 text-center text-gray-400">No compliance records.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
