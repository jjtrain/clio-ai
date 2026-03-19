"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle, Key, Users, Activity } from "lucide-react";

const frameworks = ["SOC2", "ISO27001", "HIPAA", "PCI_DSS"] as const;

export default function SecurityDashboard() {
  const dashboard = trpc.security["compliance.getDashboard"].useQuery();
  const incidents = trpc.security["incidents.getMetrics"].useQuery();
  const encryption = trpc.security["encryption.getStatus"].useQuery();

  const dashData: any = dashboard.data || {};
  const incData: any = incidents.data || {};
  const encData: any = encryption.data || {};
  const totalControls = dashData.totalControls || 0;
  const stats = [
    { label: "Security Score", value: 85, icon: Shield, color: "text-blue-600" },
    { label: "Active Incidents", value: incData.byStatus?.DETECTED ?? 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Controls Tracked", value: totalControls, icon: CheckCircle, color: "text-green-600" },
    { label: "Frameworks", value: Object.keys(dashData.byFramework || {}).length, icon: Activity, color: "text-purple-600" },
    { label: "Incident Types", value: Object.keys(incData.byType || {}).length, icon: Users, color: "text-indigo-600" },
    { label: "Encryption Keys", value: (encData || []).length, icon: Key, color: "text-amber-600" },
  ];

  const quickLinks = [
    { href: "/security/audit", label: "Audit Logs" },
    { href: "/security/compliance", label: "Compliance Center" },
    { href: "/security/incidents", label: "Incidents" },
    { href: "/security/access", label: "Access Control" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Dashboard</h1>
        <div className="flex gap-2">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="outline" size="sm">{link.label}</Button>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-sm text-gray-500">{stat.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {frameworks.map((fw) => {
          const fwData = dashData.byFramework?.[fw] || {};
          const total = Object.values(fwData).reduce((s: number, v: any) => s + (typeof v === "number" ? v : 0), 0) as number;
          const implemented = (fwData["CTRL_IMPLEMENTED"] || 0) + (fwData["CTRL_TESTED"] || 0) + (fwData["CTRL_CERTIFIED"] || 0);
          const pct = total > 0 ? Math.round((implemented / total) * 100) : 0;
          return (
            <div key={fw} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-medium">{fw.replace("_", " ")}</h3>
              <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">{pct}% ready</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="mb-4 font-semibold">Recent Security Events</h2>
        <div className="space-y-3">
          <p className="text-sm text-gray-400">No recent events</p>
        </div>
      </div>
    </div>
  );
}
