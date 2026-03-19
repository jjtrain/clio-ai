"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Search,
  Users,
  User,
} from "lucide-react";

const roleBadgeColor: Record<string, string> = {
  PARTNER: "bg-purple-100 text-purple-700",
  ASSOCIATE: "bg-blue-100 text-blue-700",
  OF_COUNSEL: "bg-indigo-100 text-indigo-700",
  PARALEGAL: "bg-green-100 text-green-700",
  ADMIN: "bg-gray-100 text-gray-700",
  OTHER: "bg-gray-100 text-gray-600",
};

function DepartmentSection({
  department,
  employees,
  expanded,
  onToggle,
}: {
  department: string;
  employees: any[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const partners = employees.filter((e: any) => e.role === "PARTNER");
  const associates = employees.filter((e: any) => e.role === "ASSOCIATE");
  const ofCounsel = employees.filter((e: any) => e.role === "OF_COUNSEL");
  const paralegals = employees.filter((e: any) => e.role === "PARALEGAL");
  const admins = employees.filter((e: any) => e.role === "ADMIN");
  const others = employees.filter(
    (e: any) =>
      !["PARTNER", "ASSOCIATE", "OF_COUNSEL", "PARALEGAL", "ADMIN"].includes(e.role)
  );

  const groups = [
    { label: "Partners", members: partners },
    { label: "Of Counsel", members: ofCounsel },
    { label: "Associates", members: associates },
    { label: "Paralegals", members: paralegals },
    { label: "Admin Staff", members: admins },
    { label: "Other", members: others },
  ].filter((g) => g.members.length > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
        )}
        <Building2 className="h-5 w-5 text-blue-500 shrink-0" />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">{department}</h3>
          <p className="text-sm text-gray-500">{employees.length} members</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {employees.length}
        </Badge>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mt-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 pl-2">
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.members.map((emp: any) => (
                  <Link
                    key={emp.id}
                    href={`/hr/employees/${emp.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-medium shrink-0">
                      {(emp.firstName?.[0] ?? "").toUpperCase()}
                      {(emp.lastName?.[0] ?? "").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {emp.fullName ?? `${emp.firstName} ${emp.lastName}`}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{emp.title ?? emp.role}</p>
                    </div>
                    <Badge className={`text-xs ${roleBadgeColor[emp.role] ?? roleBadgeColor.OTHER}`}>
                      {emp.role}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: employees, isLoading } = trpc.hr["employees.list"].useQuery({
    isActive: true,
  });

  const list = employees ?? [];

  // Group by department
  const departments: Record<string, any[]> = {};
  for (const emp of list) {
    const dept = (emp as any).department ?? "Unassigned";
    if (!departments[dept]) departments[dept] = [];
    departments[dept].push(emp);
  }

  // Filter by search
  const filteredDepts: Record<string, any[]> = {};
  for (const [dept, members] of Object.entries(departments)) {
    if (search) {
      const filtered = members.filter((e: any) => {
        const name = (e.fullName ?? `${e.firstName} ${e.lastName}`).toLowerCase();
        const title = (e.title ?? "").toLowerCase();
        return name.includes(search.toLowerCase()) || title.includes(search.toLowerCase());
      });
      if (filtered.length > 0) filteredDepts[dept] = filtered;
    } else {
      filteredDepts[dept] = members;
    }
  }

  const sortedDepts = Object.keys(filteredDepts).sort();

  const toggleDept = (dept: string) => {
    setExpanded((prev) => ({ ...prev, [dept]: !prev[dept] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    sortedDepts.forEach((d) => (all[d] = true));
    setExpanded(all);
  };

  const collapseAll = () => setExpanded({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Org Chart</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {list.length} active employees across {Object.keys(departments).length} departments
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-blue-600 hover:text-blue-700 px-3 py-2"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Departments */}
      {sortedDepts.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-3" />
          <p>No employees found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDepts.map((dept) => (
            <DepartmentSection
              key={dept}
              department={dept}
              employees={filteredDepts[dept]}
              expanded={expanded[dept] ?? false}
              onToggle={() => toggleDept(dept)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
