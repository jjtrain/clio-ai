"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Phone,
  MessageSquare,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const LEAD_TYPE_ICON: Record<string, React.ElementType> = {
  PHONE: Phone,
  MESSAGE: MessageSquare,
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "ACTIVE", label: "Active" },
  { value: "CONVERTED", label: "Converted" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "DISPUTED", label: "Disputed" },
];

const CHARGE_OPTIONS = [
  { value: "ALL", label: "All Charges" },
  { value: "CHARGED", label: "Charged" },
  { value: "NOT_CHARGED", label: "Not Charged" },
  { value: "CREDITED", label: "Credited" },
  { value: "DISPUTED", label: "Disputed" },
];

const LEAD_TYPE_OPTIONS = [
  { value: "ALL", label: "All Types" },
  { value: "PHONE", label: "Phone" },
  { value: "MESSAGE", label: "Message" },
];

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
  DISPUTED: "bg-red-100 text-red-700",
};

const CHARGE_COLORS: Record<string, string> = {
  CHARGED: "bg-yellow-100 text-yellow-700",
  NOT_CHARGED: "bg-gray-100 text-gray-600",
  CREDITED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
};

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LSALeadsPage() {
  const [page, setPage] = useState(1);
  const [leadType, setLeadType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [chargeStatus, setChargeStatus] = useState("ALL");
  const [categoryName, setCategoryName] = useState("ALL");
  const [search, setSearch] = useState("");

  const filters: Record<string, any> = {
    page,
    limit: 25,
  };
  if (leadType !== "ALL") filters.leadType = leadType;
  if (status !== "ALL") filters.status = status;
  if (chargeStatus !== "ALL") filters.chargeStatus = chargeStatus;
  if (categoryName !== "ALL") filters.categoryName = categoryName;
  if (search) filters.search = search;

  const leadsQuery = trpc.lsa["leads.list"].useQuery(filters);
  const leads = leadsQuery.data || [];
  const totalCount = leads.length;
  const totalPages = Math.ceil(totalCount / 25) || 1;

  // Get unique categories from current results for filter
  const categories = Array.from(new Set(leads.map((l: any) => l.categoryName).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/lsa">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Leads</h1>
            <p className="text-gray-500 text-sm mt-1">
              {totalCount} total lead{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={leadType}
              onValueChange={(v) => {
                setLeadType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={chargeStatus}
              onValueChange={(v) => {
                setChargeStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHARGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryName}
              onValueChange={(v) => {
                setCategoryName(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((cat: string) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Consumer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Converted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsQuery.isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-gray-500">
                    <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No leads found matching filters
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead: any) => {
                  const TypeIcon = LEAD_TYPE_ICON[lead.leadType] ?? Phone;
                  return (
                    <TableRow key={lead.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm text-gray-600">
                        {lead.createdAt
                          ? new Date(lead.createdAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <TypeIcon className="h-4 w-4 text-gray-500" />
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {lead.consumerName || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {lead.categoryName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.qualityScore !== null && lead.qualityScore !== undefined ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              lead.qualityScore >= 80
                                ? "bg-emerald-100 text-emerald-700"
                                : lead.qualityScore >= 50
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {lead.qualityScore}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {lead.leadType === "PHONE" ? formatDuration(lead.callDuration) : "-"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        ${lead.cost?.toFixed(2) ?? "0.00"}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={CHARGE_COLORS[lead.chargeStatus] ?? "bg-gray-100 text-gray-600"}>
                          {lead.chargeStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.converted ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/lsa/leads/${lead.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
