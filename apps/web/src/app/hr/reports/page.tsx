"use client";

import Link from "next/link";
import {
  BarChart3,
  DollarSign,
  Briefcase,
  CalendarDays,
  GraduationCap,
  Users,
  BookUser,
  TrendingUp,
  FileText,
  ArrowRight,
} from "lucide-react";

const reports = [
  {
    title: "Utilization Report",
    description:
      "Attorney billable hours, utilization rates, and target variance by individual and department.",
    icon: BarChart3,
    color: "bg-blue-50 text-blue-600",
    href: "/hr/utilization",
    tags: ["Billable Hours", "Targets", "Performance"],
  },
  {
    title: "Profitability Report",
    description:
      "Revenue per attorney, realization rates, and profit margins by practice area and timekeeper.",
    icon: DollarSign,
    color: "bg-green-50 text-green-600",
    href: "/hr/reports/profitability",
    tags: ["Revenue", "Margins", "Realization"],
  },
  {
    title: "Workload Report",
    description:
      "Active matters per attorney, matter assignments, and capacity analysis for balanced workloads.",
    icon: Briefcase,
    color: "bg-purple-50 text-purple-600",
    href: "/hr/reports/workload",
    tags: ["Matters", "Capacity", "Assignments"],
  },
  {
    title: "Time Off Report",
    description:
      "PTO usage, balances, and trends. Staffing level analysis by department and practice group.",
    icon: CalendarDays,
    color: "bg-amber-50 text-amber-600",
    href: "/hr/time-off",
    tags: ["PTO", "Balances", "Staffing"],
  },
  {
    title: "CLE Compliance Report",
    description:
      "Continuing Legal Education credits earned, required, and compliance status for all attorneys.",
    icon: GraduationCap,
    color: "bg-red-50 text-red-600",
    href: "/hr/cle",
    tags: ["Credits", "Compliance", "Deadlines"],
  },
  {
    title: "Headcount Report",
    description:
      "Firm headcount trends, hires, departures, and demographic breakdowns by role and department.",
    icon: Users,
    color: "bg-teal-50 text-teal-600",
    href: "/hr/reports/headcount",
    tags: ["Headcount", "Turnover", "Growth"],
  },
  {
    title: "Employee Directory Export",
    description:
      "Full employee directory with contact info, roles, departments, and status for export.",
    icon: BookUser,
    color: "bg-indigo-50 text-indigo-600",
    href: "/hr/employees",
    tags: ["Directory", "Export", "Contacts"],
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">HR Reports</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Generate and view reports across all HR functions
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Link
            key={report.title}
            href={report.href}
            className="group bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${report.color}`}
              >
                <report.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {report.title}
                  </h3>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                </div>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  {report.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {report.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
