"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, AlertTriangle } from "lucide-react";

const types = ["DATA_BREACH", "UNAUTHORIZED_ACCESS", "MALWARE", "PHISHING", "POLICY_VIOLATION"];
const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"];

const sevColor: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700", MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700", CRITICAL: "bg-red-100 text-red-700",
};
const statusColor: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700", INVESTIGATING: "bg-amber-100 text-amber-700",
  CONTAINED: "bg-blue-100 text-blue-700", RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

export default function IncidentsPage() {
  const [filters, setFilters] = useState({ type: "", severity: "", status: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "", severity: "", detectedBy: "" });

  const { data, isLoading, refetch } = trpc.security["incidents.list"].useQuery(filters);
  const create = trpc.security["incidents.create"].useMutation({
    onSuccess: () => { setOpen(false); setForm({ title: "", description: "", type: "", severity: "", detectedBy: "" }); refetch(); },
  });

  const updateFilter = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Incidents</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Create Incident</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Incident</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  {severities.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Detected by" value={form.detectedBy} onChange={(e) => setForm({ ...form, detectedBy: e.target.value })} />
              <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate(form)}>
                {create.isPending ? "Creating..." : "Submit"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-3">
          <Select value={filters.type} onValueChange={(v) => updateFilter("type", v)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.severity} onValueChange={(v) => updateFilter("severity", v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              {severities.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Assigned To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">Loading...</TableCell></TableRow>
            )}
            {((data as any) ?? []).map((inc: any) => (
              <TableRow key={inc.id}>
                <TableCell className="font-mono text-sm">{inc.number}</TableCell>
                <TableCell className="text-sm font-medium">{inc.title}</TableCell>
                <TableCell><Badge variant="outline">{inc.type?.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sevColor[inc.severity] ?? ""}`}>{inc.severity}</span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[inc.status] ?? ""}`}>{inc.status}</span>
                </TableCell>
                <TableCell className="text-xs text-gray-500">{inc.detectedAt}</TableCell>
                <TableCell className="text-sm">{inc.assignedTo ?? "Unassigned"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
