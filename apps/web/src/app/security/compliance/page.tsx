"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, ShieldCheck } from "lucide-react";

const frameworks = ["SOC2", "ISO27001", "HIPAA", "PCI_DSS"] as const;
type Framework = (typeof frameworks)[number];

const statusStyles: Record<string, { color: string; label: string }> = {
  CTRL_IMPLEMENTED: { color: "bg-green-100 text-green-700", label: "Implemented" },
  CTRL_IN_PROGRESS: { color: "bg-amber-100 text-amber-700", label: "In Progress" },
  CTRL_NOT_STARTED: { color: "bg-red-100 text-red-700", label: "Not Started" },
  CTRL_NOT_APPLICABLE: { color: "bg-gray-100 text-gray-500", label: "N/A" },
  CTRL_FAILED: { color: "bg-red-200 text-red-800", label: "Failed" },
};

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<Framework>("SOC2");

  const { data, isLoading, refetch } = trpc.security["compliance.getControls"].useQuery(
    { framework: activeTab }
  );
  const runCheck = trpc.security["compliance.runCheck"].useMutation({
    onSuccess: () => refetch(),
  });

  const controls = data ?? [];
  const implemented = controls.filter((c: any) => ["CTRL_IMPLEMENTED", "CTRL_TESTED", "CTRL_CERTIFIED"].includes(c.implementationStatus)).length;
  const readiness = controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Compliance Center</h1>
        <Button
          size="sm"
          disabled={runCheck.isPending}
          onClick={() => runCheck.mutate({ framework: activeTab })}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${runCheck.isPending ? "animate-spin" : ""}`} />
          Run Check
        </Button>
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {frameworks.map((fw) => (
          <button
            key={fw}
            onClick={() => setActiveTab(fw)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === fw ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {fw.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={readiness >= 80 ? "#16a34a" : readiness >= 50 ? "#d97706" : "#dc2626"}
                strokeWidth="3" strokeDasharray={`${readiness} ${100 - readiness}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
              {readiness}%
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">{activeTab.replace("_", " ")} Readiness</h2>
            <p className="text-sm text-gray-500">
              {controls?.length ?? 0} controls evaluated
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Control ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Checked</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">Loading...</TableCell></TableRow>
            )}
            {(controls ?? []).map((ctrl: any) => {
              const style = statusStyles[ctrl.status] ?? statusStyles.CTRL_NOT_STARTED;
              return (
                <TableRow key={ctrl.controlId}>
                  <TableCell className="font-mono text-sm">{ctrl.controlId}</TableCell>
                  <TableCell className="text-sm">{ctrl.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{ctrl.category}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${style.color}`}>
                      {style.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{ctrl.lastChecked}</TableCell>
                  <TableCell className="text-sm">{ctrl.owner}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
