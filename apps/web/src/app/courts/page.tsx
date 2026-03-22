"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building2, Scale, Users, FileText, Plus, Database } from "lucide-react";

const courtTypeBadge: Record<string, { label: string; className: string }> = {
  STATE_SUPREME: { label: "Supreme", className: "bg-blue-100 text-blue-800" },
  FEDERAL_DISTRICT: { label: "Federal District", className: "bg-purple-100 text-purple-800" },
  STATE_FAMILY: { label: "Family", className: "bg-pink-100 text-pink-800" },
  STATE_CRIMINAL: { label: "Criminal", className: "bg-red-100 text-red-800" },
  STATE_CIVIL: { label: "Civil", className: "bg-emerald-100 text-emerald-800" },
  STATE_APPELLATE: { label: "Appellate", className: "bg-amber-100 text-amber-800" },
  FEDERAL_APPELLATE: { label: "Fed. Appellate", className: "bg-indigo-100 text-indigo-800" },
  FEDERAL_BANKRUPTCY: { label: "Bankruptcy", className: "bg-orange-100 text-orange-800" },
};

const eFilingBadge: Record<string, { label: string; className: string }> = {
  NYSCEF: { label: "NYSCEF", className: "bg-green-100 text-green-800" },
  ECF_PACER: { label: "ECF/PACER", className: "bg-purple-100 text-purple-800" },
  NONE: { label: "No E-Filing", className: "bg-gray-100 text-gray-600" },
};

export default function CourtsPage() {
  const [search, setSearch] = useState("");
  const [courtType, setCourtType] = useState<string>("ALL");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");

  const { data: courts, isLoading } = trpc.courtRules["courts.list"].useQuery({
    courtType: courtType !== "ALL" ? courtType : undefined,
    state: state || undefined,
    county: county || undefined,
  });

  const seedMutation = trpc.courtRules["courts.seed"].useMutation();

  const filtered = (courts ?? []).filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.shortName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Court Directory</h1>
          <p className="mt-1 text-gray-500">Filing rules, judge profiles, and e-filing requirements by court</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <Database className="mr-1.5 h-4 w-4" />{seedMutation.isPending ? "Seeding..." : "Seed Default Courts"}
          </Button>
          <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Court</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search courts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={courtType} onValueChange={setCourtType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Court Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {Object.entries(courtTypeBadge).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} className="w-28" />
        <Input placeholder="County" value={county} onChange={(e) => setCounty(e.target.value)} className="w-32" />
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-400">Loading courts...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400">No courts found.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((court: any) => {
            const tb = courtTypeBadge[court.courtType] ?? { label: court.courtType, className: "bg-gray-100 text-gray-700" };
            const eb = eFilingBadge[court.eFilingSystem] ?? eFilingBadge.NONE!;
            return (
              <div key={court.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">{court.name}{court.shortName && <span className="ml-1 text-gray-400 font-normal">({court.shortName})</span>}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge className={tb.className} variant="secondary">{tb.label}</Badge>
                    <Badge className={eb.className} variant="secondary">{eb.label}</Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-500">{[court.county, court.state].filter(Boolean).join(", ")}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{court._count?.rules ?? 0} rules</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{court._count?.judges ?? 0} judges</span>
                </div>
                <Link href={`/courts/${court.slug}`} className="mt-auto">
                  <Button variant="outline" size="sm" className="w-full"><Scale className="mr-1.5 h-3.5 w-3.5" />View Details</Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
