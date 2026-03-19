"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  GraduationCap,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function CLETrackerPage() {
  const [search, setSearch] = useState("");
  const [complianceFilter, setComplianceFilter] = useState("ALL");

  const { data: attorneys, isLoading } = trpc.hr["cle.getTracking"].useQuery({});

  let list: any[] = (attorneys as any)?.attorneys || (Array.isArray(attorneys) ? attorneys : []);

  // Client-side filtering
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((a: any) => {
      const name = (a.fullName ?? `${a.firstName} ${a.lastName}`).toLowerCase();
      return name.includes(q);
    });
  }

  if (complianceFilter === "COMPLIANT") {
    list = list.filter((a: any) => (a.cleCreditsEarned ?? 0) >= (a.cleCreditsRequired ?? 0));
  } else if (complianceFilter === "NON_COMPLIANT") {
    list = list.filter((a: any) => (a.cleCreditsEarned ?? 0) < (a.cleCreditsRequired ?? 0));
  } else if (complianceFilter === "DEADLINE_SOON") {
    const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    list = list.filter(
      (a: any) =>
        a.cleDeadline &&
        new Date(a.cleDeadline) <= ninetyDays &&
        (a.cleCreditsEarned ?? 0) < (a.cleCreditsRequired ?? 0)
    );
  }

  const totalAttorneys = list.length;
  const compliant = list.filter(
    (a: any) => a.compliant || (Number(a.cleCredits || a.cleCreditsEarned || 0) >= Number(a.cleRequired || a.cleCreditsRequired || 0))
  ).length;
  const nonCompliant = totalAttorneys - compliant;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">CLE Tracker</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Continuing Legal Education compliance tracking
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Attorneys</span>
            <GraduationCap className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalAttorneys}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Compliant</span>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{compliant}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Non-Compliant</span>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{nonCompliant}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search attorneys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <Select value={complianceFilter} onValueChange={setComplianceFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-white">
            <SelectValue placeholder="Compliance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="COMPLIANT">Compliant</SelectItem>
            <SelectItem value="NON_COMPLIANT">Non-Compliant</SelectItem>
            <SelectItem value="DEADLINE_SOON">Deadline Within 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Attorney</TableHead>
              <TableHead>Bar State</TableHead>
              <TableHead className="text-right">Earned</TableHead>
              <TableHead className="text-right">Required</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Compliance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2" />
                  No attorneys found
                </TableCell>
              </TableRow>
            ) : (
              list.map((att: any) => {
                const earned = att.cleCreditsEarned ?? 0;
                const required = att.cleCreditsRequired ?? 0;
                const remaining = Math.max(0, required - earned);
                const isCompliant = earned >= required;
                const deadlineDate = att.cleDeadline ? new Date(att.cleDeadline) : null;
                const isDeadlineSoon =
                  deadlineDate &&
                  deadlineDate <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) &&
                  !isCompliant;

                return (
                  <TableRow key={att.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Link
                        href={`/hr/employees/${att.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {att.fullName ?? `${att.firstName} ${att.lastName}`}
                      </Link>
                      <p className="text-xs text-gray-500">{att.department}</p>
                    </TableCell>
                    <TableCell className="text-gray-600">{att.barState ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium text-gray-900">
                      {earned}
                    </TableCell>
                    <TableCell className="text-right text-gray-600">{required}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium ${remaining > 0 ? "text-red-600" : "text-green-600"}`}
                      >
                        {remaining}
                      </span>
                    </TableCell>
                    <TableCell>
                      {deadlineDate ? (
                        <span
                          className={`text-sm ${isDeadlineSoon ? "text-red-600 font-medium" : "text-gray-600"}`}
                        >
                          {deadlineDate.toLocaleDateString()}
                          {isDeadlineSoon && (
                            <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isCompliant ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Compliant
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Needs {remaining}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
