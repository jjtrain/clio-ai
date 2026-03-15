"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Plus,
  Building2,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ArrowRight,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  VALIDATING: "bg-blue-100 text-blue-700 animate-pulse",
  READY: "bg-emerald-100 text-emerald-700",
  SUBMITTING: "bg-blue-100 text-blue-700 animate-pulse",
  SUBMITTED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
};

const FILING_TYPE_COLORS: Record<string, string> = {
  INITIAL: "bg-purple-100 text-purple-700",
  SUBSEQUENT: "bg-blue-100 text-blue-700",
  SERVICE: "bg-amber-100 text-amber-700",
};

export default function EFilingDashboard() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const { data: stats } = trpc.efiling.getStats.useQuery();
  const { data: filings, isLoading } = trpc.efiling.list.useQuery(
    { status: statusFilter !== "ALL" ? statusFilter : undefined }
  );
  const { data: matters } = trpc.efiling.list.useQuery();

  const filtered = filings?.filter((f) =>
    !search ||
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.matter?.name.toLowerCase().includes(search.toLowerCase()) ||
    f.court?.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.caseNumber && f.caseNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const statCards = [
    { label: "Total Filings", value: stats?.total ?? 0, color: "text-gray-900", bg: "bg-white" },
    { label: "Pending", value: stats?.pending ?? 0, color: "text-amber-700", bg: "bg-amber-50" },
    { label: "Submitted", value: stats?.submitted ?? 0, color: "text-blue-700", bg: "bg-blue-50" },
    { label: "Accepted", value: stats?.accepted ?? 0, color: "text-green-700", bg: "bg-green-50" },
    { label: "Rejected", value: stats?.rejected ?? 0, color: "text-red-700", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <Upload className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Court E-Filing</h1>
            <p className="text-gray-500">File documents electronically with courts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/efiling/courts"><Building2 className="h-4 w-4 mr-2" /> Court Directory</Link>
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" asChild>
            <Link href="/efiling/new"><Plus className="h-4 w-4 mr-2" /> New Filing</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-gray-100 shadow-sm p-4`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search filings..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="READY">Ready</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filings Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No filings yet</h3>
            <p className="text-gray-500 mb-4">Create your first e-filing to get started</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/efiling/new"><Plus className="h-4 w-4 mr-2" /> New Filing</Link>
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Filing</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Matter</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Court</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Case #</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Filed</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link href={`/efiling/${f.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {f.title}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {f.matter ? `${f.matter.matterNumber} - ${f.matter.name}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{f.court?.name || "—"}</td>
                  <td className="py-3 px-4 text-xs text-gray-500 font-mono">{f.caseNumber || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${FILING_TYPE_COLORS[f.filingType]}`}>
                      {f.filingType}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[f.status]}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400">
                    {f.filedAt ? new Date(f.filedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/efiling/${f.id}`}><ArrowRight className="h-3 w-3" /></Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
