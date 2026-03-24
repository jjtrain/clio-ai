"use client";

import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle, Clock, DollarSign, TrendingUp, BarChart3, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AuditDetail } from "./AuditDetail";
import { RunAuditDialog } from "./RunAuditDialog";

const gradeColors: Record<string, string> = {
  A: "text-green-600 bg-green-50 border-green-200",
  B: "text-blue-600 bg-blue-50 border-blue-200",
  C: "text-yellow-600 bg-yellow-50 border-yellow-200",
  D: "text-orange-600 bg-orange-50 border-orange-200",
  F: "text-red-600 bg-red-50 border-red-200",
};

export function AuditDashboard() {
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [showRunDialog, setShowRunDialog] = useState(false);

  const { data: stats } = trpc.billingAudit.getAuditStats.useQuery();
  const { data: audits, refetch } = trpc.billingAudit.listAudits.useQuery({ limit: 20 });

  if (selectedAuditId) {
    return (
      <AuditDetail
        auditId={selectedAuditId}
        onBack={() => { setSelectedAuditId(null); refetch(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-blue-600" />
            AI Billing Audit
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review time entries and invoices for billing issues before they reach clients
          </p>
        </div>
        <Button onClick={() => setShowRunDialog(true)} className="gap-2">
          <Play className="h-4 w-4" />
          Run Audit
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAudits}</p>
                <p className="text-xs text-gray-500">Total Audits</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFlags}</p>
                <p className="text-xs text-gray-500">Issues Found</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.resolutionRate}%</p>
                <p className="text-xs text-gray-500">Resolution Rate</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalEstimatedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-500">Estimated Savings</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Common Flag Types */}
      {stats && stats.commonFlagTypes.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            Most Common Issues
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.commonFlagTypes.map((ft) => (
              <Badge key={ft.type} variant="secondary" className="text-xs px-2.5 py-1">
                {ft.type.replace(/_/g, " ")} ({ft.count})
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Audit History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          Recent Audits
        </h2>

        {(!audits || audits.length === 0) ? (
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">No audits yet</p>
            <p className="text-xs text-gray-400 mb-4">Run your first audit to review time entries for billing issues</p>
            <Button onClick={() => setShowRunDialog(true)} size="sm" className="gap-2">
              <Play className="h-3.5 w-3.5" />
              Run First Audit
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {audits.map((audit) => (
              <Card
                key={audit.id}
                className="p-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
                onClick={() => setSelectedAuditId(audit.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Grade Badge */}
                    <div className={cn(
                      "h-12 w-12 rounded-xl border-2 flex items-center justify-center font-bold text-xl",
                      gradeColors[audit.overallGrade || "?"] || "text-gray-400 bg-gray-50 border-gray-200"
                    )}>
                      {audit.overallGrade || "?"}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {audit.auditType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Audit
                        </p>
                        <Badge variant="secondary" className="text-[10px]">
                          {audit.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {audit.totalEntriesReviewed} entries · {audit.totalHoursReviewed.toFixed(1)}h · ${audit.totalAmountReviewed.toFixed(2)}
                        {audit.matterId && ` · Matter: ${audit.matterId.slice(0, 8)}...`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {audit.criticalFlags > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{audit.criticalFlags} critical</Badge>
                        )}
                        {audit.highFlags > 0 && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700">{audit.highFlags} high</Badge>
                        )}
                        {audit.mediumFlags > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{audit.mediumFlags} medium</Badge>
                        )}
                        {audit.totalFlags === 0 && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">Clean</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(audit.createdAt).toLocaleDateString()} · {audit.resolvedFlags}/{audit.totalFlags} resolved
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Run Audit Dialog */}
      {showRunDialog && (
        <RunAuditDialog
          onClose={() => setShowRunDialog(false)}
          onComplete={(auditId) => {
            setShowRunDialog(false);
            setSelectedAuditId(auditId);
            refetch();
          }}
        />
      )}
    </div>
  );
}
