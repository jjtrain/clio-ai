"use client";

import { FileCheck, Send, CheckCircle, XCircle, Clock, DollarSign, AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; icon: any }> = {
  DRAFT: { color: "bg-gray-100 text-gray-600", icon: Clock },
  READY: { color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  SUBMITTING: { color: "bg-yellow-100 text-yellow-700", icon: Clock },
  SUBMITTED: { color: "bg-yellow-100 text-yellow-700", icon: Send },
  PENDING_REVIEW: { color: "bg-orange-100 text-orange-700", icon: Clock },
  ACCEPTED: { color: "bg-green-100 text-green-700", icon: CheckCircle },
  REJECTED: { color: "bg-red-100 text-red-600", icon: XCircle },
  ERROR: { color: "bg-red-100 text-red-600", icon: AlertTriangle },
  CANCELLED: { color: "bg-gray-100 text-gray-400", icon: XCircle },
};

export function EFilingDashboard() {
  const { data: stats } = trpc.courtEfiling.getDashboardStats.useQuery();
  const { data: filings, refetch } = trpc.courtEfiling.getFilings.useQuery({});
  const { data: alerts } = trpc.courtEfiling.getAlerts.useQuery({ unreadOnly: true });
  const { data: credentials } = trpc.courtEfiling.getCredentials.useQuery();
  const pollMutation = trpc.courtEfiling.pollStatuses.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="h-7 w-7 text-blue-600" />
            Court E-Filing
          </h1>
          <p className="text-sm text-gray-500 mt-1">File documents directly to NYSCEF, PACER/CM-ECF, and Tyler Odyssey</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => pollMutation.mutate()} disabled={pollMutation.isLoading} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", pollMutation.isLoading && "animate-spin")} /> Check Statuses
          </Button>
          <Button className="gap-2"><Plus className="h-4 w-4" /> New Filing</Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.totalFiled}</p><p className="text-xs text-gray-500">Filed (30d)</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p><p className="text-xs text-gray-500">Pending</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-green-600">{stats.accepted}</p><p className="text-xs text-gray-500">Accepted</p></Card>
          <Card className="p-4"><p className={cn("text-2xl font-bold", stats.rejected > 0 ? "text-red-600" : "")}>{stats.rejected}</p><p className="text-xs text-gray-500">Rejected</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold">${stats.totalFees.toLocaleString()}</p><p className="text-xs text-gray-500">Fees</p></Card>
        </div>
      )}

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Card key={alert.id} className={cn("p-3 border-l-4", alert.alertType === "REJECTED" ? "border-l-red-500 bg-red-50" : alert.alertType === "ACCEPTED" ? "border-l-green-500 bg-green-50" : "border-l-blue-500")}>
              <p className="text-sm text-gray-900">{alert.message}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(alert.createdAt).toLocaleString()}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Credentials */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Connected Systems</h2>
        <div className="flex gap-3">
          {credentials && credentials.length > 0 ? credentials.map((c) => (
            <Badge key={c.id} variant="secondary" className="text-xs">{c.platform.name}: {c.displayName}</Badge>
          )) : (
            <p className="text-xs text-gray-400">No e-filing credentials configured. Add credentials to start filing.</p>
          )}
        </div>
      </Card>

      {/* Filing History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Filing History</h2>
        {filings && filings.length > 0 ? (
          <div className="space-y-2">
            {filings.map((f) => {
              const sc = statusConfig[f.status] || statusConfig.DRAFT;
              const Icon = sc.icon;
              return (
                <Card key={f.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", sc.color.split(" ")[0])}>
                      <Icon className={cn("h-4 w-4", sc.color.split(" ")[1])} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.filingTypeName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{f.courtName}</span>
                        <Badge className="text-[10px]" variant="outline">{f.platform?.name}</Badge>
                        {f.confirmationNumber && <span className="text-xs text-green-600">#{f.confirmationNumber}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn("text-[10px]", sc.color)}>{f.status}</Badge>
                    <span className="text-xs text-gray-400">{f.submittedAt ? new Date(f.submittedAt).toLocaleDateString() : "Draft"}</span>
                    {f._count.documents > 0 && <span className="text-[10px] text-gray-400">{f._count.documents} docs</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <FileCheck className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No court filings yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
