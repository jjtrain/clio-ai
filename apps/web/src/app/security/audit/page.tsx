"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown, ChevronRight } from "lucide-react";

const severityColor: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

export default function AuditLogPage() {
  const [filters, setFilters] = useState({
    from: "", to: "", user: "", action: "", category: "", severity: "", success: "",
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const update = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const queryParams: any = {};
  if (filters.action) queryParams.action = filters.action;
  if (filters.category) queryParams.category = filters.category;
  if (filters.severity) queryParams.severity = filters.severity;
  if (filters.user) queryParams.userId = filters.user;
  if (filters.success) queryParams.success = filters.success === "true";
  if (filters.from && filters.to) queryParams.dateRange = { from: filters.from, to: filters.to };
  const { data, isLoading } = trpc.security["audit.list"].useQuery(queryParams);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Input type="date" placeholder="From" value={filters.from} onChange={(e) => update("from", e.target.value)} />
          <Input type="date" placeholder="To" value={filters.to} onChange={(e) => update("to", e.target.value)} />
          <Input placeholder="Search user..." value={filters.user} onChange={(e) => update("user", e.target.value)} />
          <Select value={filters.action} onValueChange={(v) => update("action", v)}>
            <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              {["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT"].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.category} onValueChange={(v) => update("category", v)}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {["AUTH", "DATA", "CONFIG", "ACCESS"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.severity} onValueChange={(v) => update("severity", v)}>
            <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.success} onValueChange={(v) => update("success", v)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Success</SelectItem>
              <SelectItem value="false">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-gray-400">Loading...</TableCell></TableRow>
            )}
            {(data ?? []).map((row: any) => (
              <>
                <TableRow key={row.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                  <TableCell>{expandedId === row.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{row.timestamp}</TableCell>
                  <TableCell className="text-sm">{row.user}</TableCell>
                  <TableCell><Badge variant="outline">{row.action}</Badge></TableCell>
                  <TableCell className="text-sm">{row.resource}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{row.description}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded-full ${severityColor[row.severity] ?? ""}`}>{row.severity}</span></TableCell>
                  <TableCell className="text-xs text-gray-500">{row.ip}</TableCell>
                  <TableCell><Badge variant={row.success ? "default" : "destructive"}>{row.success ? "OK" : "FAIL"}</Badge></TableCell>
                </TableRow>
                {expandedId === row.id && (
                  <TableRow key={`${row.id}-detail`}>
                    <TableCell colSpan={9} className="bg-gray-50 p-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium mb-1">Previous Value</p>
                          <pre className="bg-white rounded p-2 text-xs overflow-auto">{JSON.stringify(row.previousValue, null, 2) ?? "N/A"}</pre>
                        </div>
                        <div>
                          <p className="font-medium mb-1">New Value</p>
                          <pre className="bg-white rounded p-2 text-xs overflow-auto">{JSON.stringify(row.newValue, null, 2) ?? "N/A"}</pre>
                        </div>
                        {row.metadata && (
                          <div className="col-span-2">
                            <p className="font-medium mb-1">Metadata</p>
                            <pre className="bg-white rounded p-2 text-xs overflow-auto">{JSON.stringify(row.metadata, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
