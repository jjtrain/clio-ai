"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Search, Users, Plus, Mail, Phone } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "ALL", label: "All Roles" },
  { value: "PARTNER", label: "Partner" },
  { value: "ASSOCIATE", label: "Associate" },
  { value: "OF_COUNSEL", label: "Of Counsel" },
  { value: "PARALEGAL", label: "Paralegal" },
  { value: "ADMIN", label: "Admin" },
  { value: "OTHER", label: "Other" },
];

const DEPARTMENT_OPTIONS = [
  { value: "ALL", label: "All Departments" },
  { value: "LITIGATION", label: "Litigation" },
  { value: "CORPORATE", label: "Corporate" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "FAMILY", label: "Family" },
  { value: "CRIMINAL", label: "Criminal" },
  { value: "IP", label: "IP" },
  { value: "TAX", label: "Tax" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "OTHER", label: "Other" },
];

const ACTIVE_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const roleBadgeColor: Record<string, string> = {
  PARTNER: "bg-purple-100 text-purple-700",
  ASSOCIATE: "bg-blue-100 text-blue-700",
  OF_COUNSEL: "bg-indigo-100 text-indigo-700",
  PARALEGAL: "bg-green-100 text-green-700",
  ADMIN: "bg-gray-100 text-gray-700",
  OTHER: "bg-gray-100 text-gray-600",
};

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const { data: employees, isLoading } = trpc.hr["employees.list"].useQuery({
    search: search || undefined,
    role: roleFilter !== "ALL" ? roleFilter : undefined,
    department: deptFilter !== "ALL" ? deptFilter : undefined,
    isActive: activeFilter !== "ALL" ? activeFilter === "true" : undefined,
  });

  const list = employees ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employee Directory</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {list.length} employee{list.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button className="bg-blue-500 hover:bg-blue-600 shadow-sm w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, email, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-white">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-full sm:w-[140px] bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            <Users className="h-8 w-8 mx-auto mb-2" />
            <p>No employees found</p>
          </div>
        ) : (
          list.map((emp: any) => (
            <Link
              key={emp.id}
              href={`/hr/employees/${emp.id}`}
              className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900">
                  {emp.fullName ?? `${emp.firstName} ${emp.lastName}`}
                </p>
                <Badge className={roleBadgeColor[emp.role] ?? roleBadgeColor.OTHER}>
                  {emp.role}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">{emp.title}</p>
              <p className="text-xs text-gray-400 mt-1">{emp.department}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                {emp.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {emp.email}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Active Matters</TableHead>
              <TableHead className="text-right">Utilization %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  No employees found
                </TableCell>
              </TableRow>
            ) : (
              list.map((emp: any) => (
                <TableRow key={emp.id} className="hover:bg-gray-50 cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/hr/employees/${emp.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {emp.fullName ?? `${emp.firstName} ${emp.lastName}`}
                    </Link>
                    {!emp.isActive && (
                      <Badge variant="outline" className="ml-2 text-xs text-gray-400">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600">{emp.title ?? "-"}</TableCell>
                  <TableCell>
                    <Badge className={roleBadgeColor[emp.role] ?? roleBadgeColor.OTHER}>
                      {emp.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">{emp.department ?? "-"}</TableCell>
                  <TableCell>
                    {emp.email ? (
                      <a
                        href={`mailto:${emp.email}`}
                        className="text-gray-600 hover:text-blue-600 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="h-3 w-3" />
                        {emp.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {emp.phone ? (
                      <span className="text-gray-600 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {emp.phone}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-gray-700">
                    {emp.activeMattersCount ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${
                        (emp.utilizationPercent ?? 0) >= 80
                          ? "text-green-600"
                          : (emp.utilizationPercent ?? 0) >= 60
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {emp.utilizationPercent ?? 0}%
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
