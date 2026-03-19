"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";

const TRANSACTION_TYPES: Record<string, string> = {
  PURCHASE: "Purchase",
  SALE: "Sale",
  REFINANCE: "Refinance",
  TRANSFER: "Transfer",
  LEASE: "Lease",
  COMMERCIAL_PURCHASE: "Commercial Purchase",
  COMMERCIAL_SALE: "Commercial Sale",
  COMMERCIAL_LEASE: "Commercial Lease",
  NEW_CONSTRUCTION: "New Construction",
  SHORT_SALE: "Short Sale",
  FORECLOSURE: "Foreclosure",
  ESTATE_SALE: "Estate Sale",
  AUCTION: "Auction",
  EXCHANGE_1031: "1031 Exchange",
};

const STATUSES: Record<string, string> = {
  INTAKE: "Intake",
  CONTRACT_REVIEW: "Contract Review",
  DUE_DILIGENCE: "Due Diligence",
  TITLE_SEARCH: "Title Search",
  TITLE_CLEARANCE: "Title Clearance",
  MORTGAGE_PROCESSING: "Mortgage Processing",
  SURVEY: "Survey",
  INSPECTIONS: "Inspections",
  CLOSING_PREP: "Closing Prep",
  CLOSING_SCHEDULED: "Closing Scheduled",
  CLOSED: "Closed",
  POST_CLOSING: "Post-Closing",
  RECORDED: "Recorded",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ROLES: Record<string, string> = {
  BUYER_ATTORNEY: "Buyer Attorney",
  SELLER_ATTORNEY: "Seller Attorney",
  LENDER_ATTORNEY: "Lender Attorney",
  DUAL_REPRESENTATION: "Dual Rep",
};

function typeBadgeVariant(type: string) {
  if (type.startsWith("COMMERCIAL")) return "default" as const;
  if (["PURCHASE", "NEW_CONSTRUCTION"].includes(type)) return "secondary" as const;
  return "outline" as const;
}

function roleBadgeVariant(role: string) {
  if (role === "BUYER_ATTORNEY") return "default" as const;
  if (role === "SELLER_ATTORNEY") return "secondary" as const;
  return "outline" as const;
}

function statusBadgeVariant(status: string) {
  if (["COMPLETED", "RECORDED"].includes(status)) return "default" as const;
  if (["CANCELLED"].includes(status)) return "destructive" as const;
  if (["CLOSING_SCHEDULED", "CLOSED"].includes(status)) return "secondary" as const;
  return "outline" as const;
}

export default function ConveyancingMattersPage() {
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [search, setSearch] = useState("");

  const { data: matters } = trpc.conveyancing["matters.list"].useQuery({});
  const all = (matters as any)?.items || matters || [];

  const filtered = all.filter((c: any) => {
    if (filterType && c.transactionType !== filterType) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterRole && c.role !== filterRole) return false;
    if (search && !c.propertyAddress?.toLowerCase().includes(search.toLowerCase()) && !c.matter?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Conveyancing Transactions</h1>
        <Link href="/conveyancing/matters/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New Transaction</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search property or matter..."
            className="pl-9 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {Object.entries(TRANSACTION_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {Object.entries(ROLES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Property</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-left font-medium">Closing Date</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Checklist %</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => {
                  const price = parseFloat(c.purchasePrice || c.salePrice || "0");
                  const checklistPct = c.checklists?.length
                    ? Math.round(
                        c.checklists.reduce((s: number, cl: any) => s + parseFloat(cl.completionPercentage || "0"), 0) /
                        c.checklists.length
                      )
                    : 0;
                  const openTe = c.titleExceptions?.filter(
                    (te: any) => te.status === "OPEN" || te.status === "IN_PROGRESS"
                  ).length || 0;
                  return (
                    <tr key={c.id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/conveyancing/matters/${c.id}`} className="font-medium hover:underline">
                          {c.propertyAddress}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={typeBadgeVariant(c.transactionType)}>
                          {TRANSACTION_TYPES[c.transactionType] || c.transactionType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={roleBadgeVariant(c.role)}>
                          {ROLES[c.role] || c.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.matter?.name}</td>
                      <td className="px-4 py-3 text-right">${price.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {c.closingDate ? new Date(c.closingDate).toLocaleDateString() : "--"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(c.status)}>
                          {STATUSES[c.status] || c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{checklistPct}%</td>
                      <td className="px-4 py-3">
                        {openTe > 0 ? (
                          <Badge variant="destructive">{openTe} open</Badge>
                        ) : (
                          <Badge variant="outline">Clear</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
