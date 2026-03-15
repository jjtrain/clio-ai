"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Search,
  Building2,
  ExternalLink,
  X,
} from "lucide-react";

const COURT_TYPE_COLORS: Record<string, string> = {
  FEDERAL_DISTRICT: "bg-blue-100 text-blue-700",
  FEDERAL_APPELLATE: "bg-indigo-100 text-indigo-700",
  FEDERAL_SUPREME: "bg-purple-100 text-purple-700",
  STATE_TRIAL: "bg-emerald-100 text-emerald-700",
  STATE_APPELLATE: "bg-teal-100 text-teal-700",
  STATE_SUPREME: "bg-cyan-100 text-cyan-700",
  FAMILY: "bg-pink-100 text-pink-700",
  BANKRUPTCY: "bg-amber-100 text-amber-700",
  TAX: "bg-orange-100 text-orange-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const COURT_TYPE_LABELS: Record<string, string> = {
  FEDERAL_DISTRICT: "Federal District",
  FEDERAL_APPELLATE: "Federal Appellate",
  FEDERAL_SUPREME: "Federal Supreme",
  STATE_TRIAL: "State Trial",
  STATE_APPELLATE: "State Appellate",
  STATE_SUPREME: "State Supreme",
  FAMILY: "Family",
  BANKRUPTCY: "Bankruptcy",
  TAX: "Tax",
  OTHER: "Other",
};

export default function CourtDirectoryPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showAdd, setShowAdd] = useState(false);

  // New court form
  const [newName, setNewName] = useState("");
  const [newState, setNewState] = useState("");
  const [newCounty, setNewCounty] = useState("");
  const [newType, setNewType] = useState("STATE_TRIAL");
  const [newUrl, setNewUrl] = useState("");
  const [newProvider, setNewProvider] = useState("");

  const { data: courts, isLoading } = trpc.efiling.listCourts.useQuery({
    state: stateFilter !== "ALL" ? stateFilter : undefined,
    courtType: typeFilter !== "ALL" ? typeFilter : undefined,
    search: search || undefined,
  });

  const createCourt = trpc.efiling.createCourt.useMutation({
    onSuccess: () => {
      toast({ title: "Court added" });
      utils.efiling.listCourts.invalidate();
      setShowAdd(false);
      setNewName(""); setNewState(""); setNewCounty(""); setNewUrl(""); setNewProvider("");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Get unique states for filter
  const states = Array.from(new Set(courts?.map((c) => c.state) || [])).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/efiling"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Court Directory</h1>
            <p className="text-gray-500">Manage courts and e-filing configurations</p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Court
        </Button>
      </div>

      {/* Add Court Dialog */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Add New Court</h2>
            <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <Label>Court Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Supreme Court, Nassau County" />
            </div>
            <div className="space-y-1">
              <Label>State *</Label>
              <Input value={newState} onChange={(e) => setNewState(e.target.value)} placeholder="e.g., NY" />
            </div>
            <div className="space-y-1">
              <Label>County</Label>
              <Input value={newCounty} onChange={(e) => setNewCounty(e.target.value)} placeholder="e.g., Nassau" />
            </div>
            <div className="space-y-1">
              <Label>Court Type *</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COURT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>E-Filing Provider</Label>
              <Input value={newProvider} onChange={(e) => setNewProvider(e.target.value)} placeholder="e.g., NYSCEF, CM/ECF" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>E-Filing URL</Label>
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => createCourt.mutate({
                name: newName,
                state: newState,
                courtType: newType,
                county: newCounty || undefined,
                efilingUrl: newUrl || undefined,
                efilingProvider: newProvider || undefined,
              })}
              disabled={!newName || !newState || createCourt.isPending}
            >
              {createCourt.isPending ? "Adding..." : "Add Court"}
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courts..." className="pl-9" />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All States</SelectItem>
            {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Court Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {Object.entries(COURT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Courts List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : !courts || courts.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No courts found</h3>
            <p className="text-gray-500">Add courts or adjust your filters</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Court Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">State</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">County</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Provider</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Filings</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{court.name}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{court.state}</td>
                  <td className="py-3 px-4 text-gray-500">{court.county || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${COURT_TYPE_COLORS[court.courtType]}`}>
                      {COURT_TYPE_LABELS[court.courtType] || court.courtType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{court.efilingProvider || "—"}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{(court as any)._count?.submissions ?? 0}</td>
                  <td className="py-3 px-4 text-right">
                    {court.efilingUrl && (
                      <a href={court.efilingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        Portal <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
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
