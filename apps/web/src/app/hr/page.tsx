"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Users,
  Scale,
  TrendingUp,
  TrendingDown,
  CalendarOff,
  Briefcase,
  DollarSign,
  AlertTriangle,
  Clock,
  GraduationCap,
  ChevronRight,
  UserCheck,
  BarChart3,
  CalendarDays,
  Building2,
  FileText,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  change,
  prefix,
  suffix,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  change?: number | null;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {prefix}
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix}
      </div>
      {change !== null && change !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {change >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={`text-sm font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {change >= 0 ? "+" : ""}
            {change}%
          </span>
          <span className="text-xs text-gray-400 ml-1">vs last month</span>
        </div>
      )}
    </div>
  );
}

export default function HRDashboardPage() {
  const { data: employees, isLoading } = trpc.hr["employees.list"].useQuery({});
  const { data: timeOffRequests } = trpc.hr["timeOff.list"].useQuery({});
  const { data: utilization } = trpc.hr["utilization.getForFirm"].useQuery({});

  const allEmployees = employees ?? [];
  const activeEmployees = allEmployees.filter((e: any) => e.isActive);
  const attorneys = activeEmployees.filter(
    (e: any) => e.role === "PARTNER" || e.role === "ASSOCIATE" || e.role === "OF_COUNSEL"
  );

  const outToday: any[] = [];
  const firmUtilization = utilization?.avgUtilization ?? 0;
  const openMattersPerAttorney = 0;
  const revenuePerAttorney = utilization?.totalRevenue && utilization?.attorneys ? Math.round(Number(utilization.totalRevenue) / utilization.attorneys) : 0;

  const pendingPTO = (timeOffRequests ?? []).filter((r: any) => r.status === "PENDING");
  const topPerformers = utilization?.results ?? [];

  const upcomingCLEDeadlines = activeEmployees
    .filter((e: any) => e.cleDeadline && new Date(e.cleDeadline) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
    .sort((a: any, b: any) => new Date(a.cleDeadline).getTime() - new Date(b.cleDeadline).getTime())
    .slice(0, 5);

  const belowTarget = activeEmployees.filter(
    (e: any) =>
      e.targetBillableHours &&
      e.currentBillableHours !== undefined &&
      e.currentBillableHours < e.targetBillableHours * 0.8
  );

  const alerts: { type: string; message: string; icon: React.ElementType; color: string }[] = [];
  if (pendingPTO.length > 0) {
    alerts.push({
      type: "pto",
      message: `${pendingPTO.length} PTO request${pendingPTO.length > 1 ? "s" : ""} pending approval`,
      icon: CalendarOff,
      color: "text-amber-600 bg-amber-50",
    });
  }
  if (upcomingCLEDeadlines.length > 0) {
    alerts.push({
      type: "cle",
      message: `${upcomingCLEDeadlines.length} CLE deadline${upcomingCLEDeadlines.length > 1 ? "s" : ""} within 90 days`,
      icon: GraduationCap,
      color: "text-red-600 bg-red-50",
    });
  }
  if (belowTarget.length > 0) {
    alerts.push({
      type: "target",
      message: `${belowTarget.length} attorney${belowTarget.length > 1 ? "s" : ""} below 80% of billable target`,
      icon: AlertTriangle,
      color: "text-orange-600 bg-orange-50",
    });
  }

  const quickLinks = [
    { label: "Employee Directory", href: "/hr/employees", icon: Users },
    { label: "Utilization", href: "/hr/utilization", icon: BarChart3 },
    { label: "Time Off", href: "/hr/time-off", icon: CalendarDays },
    { label: "Org Chart", href: "/hr/org-chart", icon: Building2 },
    { label: "CLE Tracker", href: "/hr/cle", icon: GraduationCap },
    { label: "Reports", href: "/hr/reports", icon: FileText },
  ];

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
        <h1 className="text-2xl font-semibold text-gray-900">HR Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">Firm-wide human resources overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Headcount" value={activeEmployees.length} icon={Users} />
        <StatCard label="Attorneys" value={attorneys.length} icon={Scale} />
        <StatCard
          label="Firm Utilization"
          value={firmUtilization}
          icon={TrendingUp}
          suffix="%"
        />
        <StatCard label="Out Today" value={outToday.length} icon={CalendarOff} />
        <StatCard
          label="Open Matters / Attorney"
          value={openMattersPerAttorney.toFixed(1)}
          icon={Briefcase}
        />
        <StatCard
          label="Revenue / Attorney"
          value={revenuePerAttorney.toLocaleString()}
          icon={DollarSign}
          prefix="$"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Utilization Leaderboard */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Utilization Leaderboard</h2>
            <Link href="/hr/utilization" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {(topPerformers.length > 0 ? topPerformers : attorneys.slice(0, 5)).map(
              (emp: any, i: number) => (
                <div key={emp.id ?? i} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {emp.fullName ?? `${emp.firstName} ${emp.lastName}`}
                    </p>
                    <p className="text-xs text-gray-500">{emp.department}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {emp.utilizationPercent ?? 0}%
                    </span>
                  </div>
                </div>
              )
            )}
            {attorneys.length === 0 && topPerformers.length === 0 && (
              <p className="text-sm text-gray-400">No data available</p>
            )}
          </div>
        </div>

        {/* Who's Out */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Who&apos;s Out</h2>
            <Link href="/hr/time-off" className="text-sm text-blue-600 hover:text-blue-700">
              View calendar
            </Link>
          </div>
          <div className="space-y-3">
            {outToday.length > 0 ? (
              outToday.slice(0, 6).map((emp: any) => (
                <div key={emp.id} className="flex items-center gap-3">
                  <CalendarOff className="h-4 w-4 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {emp.fullName ?? `${emp.firstName} ${emp.lastName}`}
                    </p>
                    <p className="text-xs text-gray-500">{emp.title}</p>
                  </div>
                  <span className="text-xs text-gray-400">Today</span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center py-6 text-gray-400">
                <UserCheck className="h-8 w-8 mb-2" />
                <p className="text-sm">Everyone is in today</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Alerts</h2>
          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-lg p-3 ${alert.color}`}>
                  <alert.icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{alert.message}</p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center py-6 text-gray-400">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p className="text-sm">No alerts</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all"
            >
              <link.icon className="h-6 w-6 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 text-center">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
