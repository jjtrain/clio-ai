"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShieldAlert,
  Search,
  Users,
  Briefcase,
  UserPlus,
  Inbox,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const roleLabels: Record<string, string> = {
  OPPOSING_PARTY: "Opposing Party",
  OPPOSING_COUNSEL: "Opposing Counsel",
  CO_COUNSEL: "Co-Counsel",
  WITNESS: "Witness",
  EXPERT_WITNESS: "Expert Witness",
  JUDGE: "Judge",
  MEDIATOR: "Mediator",
  GUARDIAN: "Guardian",
  INTERESTED_PARTY: "Interested Party",
  OTHER: "Other",
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  CLEARED: { label: "Cleared", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  CONFLICT: { label: "Conflict", color: "bg-red-100 text-red-700", icon: XCircle },
  WAIVED: { label: "Waived", color: "bg-blue-100 text-blue-700", icon: ShieldOff },
};

export default function ConflictsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = trpc.conflicts.search.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setHasSearched(true);
    },
  });

  const { data: checksData, isLoading: checksLoading } = trpc.conflicts.listChecks.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const resolveCheck = trpc.conflicts.resolveCheck.useMutation({
    onSuccess: () => utils.conflicts.listChecks.invalidate(),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate({ query: searchQuery, searchType: "MANUAL" });
  };

  const categories = results
    ? [
        { key: "clients", label: "Clients", icon: Users, items: results.clients, color: "blue", linkFn: (item: any) => `/clients/${item.id}` },
        { key: "matters", label: "Matters", icon: Briefcase, items: results.matters, color: "purple", linkFn: (item: any) => `/matters/${item.id}` },
        { key: "relatedParties", label: "Related Parties", icon: UserPlus, items: results.relatedParties, color: "orange", linkFn: (item: any) => `/matters/${item.matter?.id}` },
        { key: "leads", label: "Leads", icon: Inbox, items: results.leads, color: "teal", linkFn: () => "/leads" },
        { key: "intakeSubmissions", label: "Intake Submissions", icon: ClipboardList, items: results.intakeSubmissions, color: "amber", linkFn: () => "/intake-forms" },
      ].filter((c) => c.items.length > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Conflict of Interest Check</h1>
        <p className="text-gray-500 mt-1">Search across all records to identify potential conflicts</p>
      </div>

      {/* Search */}
      <Card className="shadow-sm border-gray-100">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <ShieldAlert className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Enter a name, email, phone, or company to check for conflicts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 text-base bg-white border-gray-200"
              />
            </div>
            <Button type="submit" disabled={searchMutation.isLoading || !searchQuery.trim()} className="h-12 px-6 bg-blue-500 hover:bg-blue-600">
              {searchMutation.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Check
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={cn(
            "rounded-xl border p-4 flex items-center gap-3",
            results.total === 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-300 bg-amber-50"
          )}>
            {results.total === 0 ? (
              <>
                <CheckCircle className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-800">No Conflicts Found</p>
                  <p className="text-sm text-emerald-600">No matching records found for &quot;{searchQuery}&quot;</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800">
                    {results.total} Potential Match{results.total !== 1 ? "es" : ""} Found
                  </p>
                  <p className="text-sm text-amber-600">
                    Review the results below for &quot;{searchQuery}&quot;
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Category Results */}
          {categories.map((cat) => (
            <Card key={cat.key} className="shadow-sm border-gray-100">
              <CardHeader className="pb-3 px-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <cat.icon className={`h-5 w-5 text-${cat.color}-600`} />
                  <CardTitle className="text-base font-semibold">{cat.label}</CardTitle>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${cat.color}-100 text-${cat.color}-700`}>
                    {cat.items.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <div className="space-y-2">
                  {cat.items.map((item: any) => (
                    <Link
                      key={item.id}
                      href={cat.linkFn(item)}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {item.name || item.submitterName || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[
                            item.email || item.submitterEmail,
                            item.phone || item.submitterPhone,
                            item.company,
                            item.role ? roleLabels[item.role] || item.role : null,
                            item.matterNumber,
                            item.client?.name ? `Client: ${item.client.name}` : null,
                            item.matter?.name ? `Matter: ${item.matter.name}` : null,
                            item.template?.name ? `Form: ${item.template.name}` : null,
                            item.status,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Check History */}
      <Card className="shadow-sm border-gray-100">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg font-semibold">Check History</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {checksLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : !checksData?.checks.length ? (
            <p className="text-gray-500 text-sm text-center py-6">No conflict checks performed yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="font-semibold text-gray-600">Query</TableHead>
                    <TableHead className="font-semibold text-gray-600">Type</TableHead>
                    <TableHead className="font-semibold text-gray-600">Results</TableHead>
                    <TableHead className="font-semibold text-gray-600">Status</TableHead>
                    <TableHead className="font-semibold text-gray-600">Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checksData.checks.map((check: any) => {
                    const sc = statusConfig[check.status] || statusConfig.PENDING;
                    return (
                      <TableRow key={check.id} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium text-gray-900">{check.searchQuery}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                            {check.searchType.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-xs font-medium",
                            check.resultsCount > 0 ? "text-amber-600" : "text-gray-500"
                          )}>
                            {check.resultsCount} match{check.resultsCount !== 1 ? "es" : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", sc.color)}>
                            <sc.icon className="h-3 w-3" />
                            {sc.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">
                          {new Date(check.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {check.status === "PENDING" && check.resultsCount > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => resolveCheck.mutate({ id: check.id, status: "CLEARED", resolution: "Reviewed and cleared" })}>
                                  <ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" />
                                  Clear
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => resolveCheck.mutate({ id: check.id, status: "CONFLICT", resolution: "Conflict identified" })}>
                                  <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                  Flag Conflict
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => resolveCheck.mutate({ id: check.id, status: "WAIVED", resolution: "Conflict waived" })}>
                                  <ShieldOff className="mr-2 h-4 w-4 text-blue-500" />
                                  Waive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
