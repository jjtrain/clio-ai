"use client";

import { FileText, DollarSign, Clock, Send, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

const gradeColors: Record<string, string> = { A: "bg-green-100 text-green-700", B: "bg-blue-100 text-blue-700", C: "bg-yellow-100 text-yellow-700", D: "bg-orange-100 text-orange-700", F: "bg-red-100 text-red-700" };
const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-600", approved: "bg-blue-100 text-blue-700", sent: "bg-green-100 text-green-700", paid: "bg-emerald-100 text-emerald-700", overdue: "bg-red-100 text-red-600", voided: "bg-gray-100 text-gray-400" };

export function BatchInvoicingHub() {
  const { data: stats } = trpc.invoicing.getInvoicingStats.useQuery();
  const { data: batches } = trpc.invoicing.getBatches.useQuery({});
  const { data: templates } = trpc.invoicing.getTemplates.useQuery({});
  const { data: invoices } = trpc.invoicing.getInvoices.useQuery({ limit: 10 });
  const { data: schedules } = trpc.invoicing.getSchedules.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            Invoicing
          </h1>
          <p className="text-sm text-gray-500 mt-1">Generate, review, and send invoices with practice-area templates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Single Invoice</Button>
          <Button className="gap-2"><Send className="h-4 w-4" /> Generate Monthly</Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">${stats.totalInvoiced.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Invoiced</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-green-600">${stats.totalCollected.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Collected</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-orange-600">${stats.totalOutstanding.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Outstanding</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.invoiceCount}</p>
            <p className="text-xs text-gray-500">Invoices</p>
          </Card>
        </div>
      )}

      {/* Active Batches */}
      {batches && batches.filter((b) => b.status !== "sent" && b.status !== "completed").length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Batches</h2>
          {batches.filter((b) => b.status !== "sent" && b.status !== "completed").map((batch) => (
            <Card key={batch.id} className="p-4 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{batch.batchName}</p>
                  <p className="text-xs text-gray-500">{batch.totalItems} items · ${batch.totalAmount.toLocaleString()} · {batch.approvedItems} approved</p>
                </div>
                <Badge className={cn("text-[10px]", batch.status === "review" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700")}>{batch.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Schedules */}
      {schedules && schedules.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" /> Scheduled Invoicing</h2>
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-700">{s.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{s.nextRunAt ? `Next: ${new Date(s.nextRunAt).toLocaleDateString()}` : ""}</span>
                <Badge variant={s.isActive ? "secondary" : "outline"} className="text-[10px]">{s.isActive ? "Active" : "Paused"}</Badge>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Recent Invoices */}
      {invoices && invoices.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Invoices</h2>
          <div className="space-y-1.5">
            {invoices.map((inv) => (
              <Card key={inv.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500 w-28">{inv.invoiceNumber}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.clientName}</p>
                    <p className="text-xs text-gray-400">{inv.matterName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">${inv.totalDue.toLocaleString()}</span>
                  {inv.auditGrade && <Badge className={cn("text-[10px]", gradeColors[inv.auditGrade] || "")}>{inv.auditGrade}</Badge>}
                  <Badge className={cn("text-[10px]", statusColors[inv.status] || "bg-gray-100 text-gray-600")}>{inv.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Templates */}
      {templates && templates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Invoice Templates</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
            {templates.map((t) => (
              <Card key={t.id} className="p-3">
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">{t.practiceArea.replace(/_/g, " ")}</Badge>
                  {t.billingModel && <Badge variant="outline" className="text-[10px] capitalize">{t.billingModel.replace(/_/g, " ")}</Badge>}
                  {t.isDefault && <Badge className="text-[10px] bg-yellow-100 text-yellow-700">Default</Badge>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
