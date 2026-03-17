"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Search, Plus, ArrowRight } from "lucide-react";

const RISK_COLORS: Record<string, string> = { LOW: "bg-emerald-100 text-emerald-700", MEDIUM: "bg-blue-100 text-blue-700", HIGH: "bg-amber-100 text-amber-700", VERY_HIGH: "bg-red-100 text-red-700" };
const STATUS_COLORS: Record<string, string> = { NOT_STARTED: "bg-gray-100 text-gray-700", PENDING_CLIENT: "bg-amber-100 text-amber-700", IN_PROGRESS: "bg-blue-100 text-blue-700", AWAITING_DOCUMENTS: "bg-purple-100 text-purple-700", UNDER_REVIEW: "bg-indigo-100 text-indigo-700", PASSED: "bg-emerald-100 text-emerald-700", FAILED: "bg-red-100 text-red-700", REFERRED: "bg-orange-100 text-orange-700", EXPIRED: "bg-gray-100 text-gray-500", CANCELLED: "bg-gray-100 text-gray-400" };

export default function ChecksPage() {
  const [status, setStatus] = useState<string>("all");
  const [riskLevel, setRiskLevel] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: checks, isLoading } = trpc.compliance["checks.list"].useQuery({
    status: status !== "all" ? status as any : undefined,
    overallRiskLevel: riskLevel !== "all" ? riskLevel as any : undefined,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Compliance Checks</h1><p className="text-sm text-slate-500">All KYC/AML checks</p></div>
        <Link href="/compliance/checks/new"><Button><Plus className="h-4 w-4 mr-2" /> New Check</Button></Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input className="pl-9" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["PENDING_CLIENT", "IN_PROGRESS", "UNDER_REVIEW", "PASSED", "FAILED", "EXPIRED"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={riskLevel} onValueChange={setRiskLevel}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk</SelectItem>
            {["LOW", "MEDIUM", "HIGH", "VERY_HIGH"].map(r => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-gray-500">Date</th>
                  <th className="pb-2 font-medium text-gray-500">Subject</th>
                  <th className="pb-2 font-medium text-gray-500">Type</th>
                  <th className="pb-2 font-medium text-gray-500">Matter</th>
                  <th className="pb-2 font-medium text-gray-500">Check Type</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Status</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Risk</th>
                  <th className="pb-2 font-medium text-gray-500 text-right">Score</th>
                  <th className="pb-2 font-medium text-gray-500">Expires</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {(checks || []).map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 font-medium">{c.subjectName}</td>
                    <td className="py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{c.subjectType}</span></td>
                    <td className="py-3 text-gray-600">{c.matter?.name || "—"}</td>
                    <td className="py-3 text-gray-600">{c.checkType}</td>
                    <td className="py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>{c.status.replace(/_/g, " ")}</span></td>
                    <td className="py-3 text-center">{c.overallRiskLevel ? <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_COLORS[c.overallRiskLevel]}`}>{c.overallRiskLevel}</span> : "—"}</td>
                    <td className="py-3 text-right">{c.riskScore ?? "—"}</td>
                    <td className="py-3 text-gray-500">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</td>
                    <td className="py-3"><Link href={`/compliance/checks/${c.id}`}><ArrowRight className="h-4 w-4 text-gray-300 hover:text-blue-500" /></Link></td>
                  </tr>
                ))}
                {(!checks || checks.length === 0) && <tr><td colSpan={10} className="py-8 text-center text-gray-400">No checks found.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
