"use client";

import { useState } from "react";
import { DollarSign, Clock, AlertTriangle, Send, CheckCircle, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const stageLabels: Record<string, { label: string; color: string }> = {
  NONE: { label: "No Action", color: "bg-gray-100 text-gray-500" },
  REMINDER_30: { label: "30-Day Reminder", color: "bg-yellow-100 text-yellow-700" },
  REMINDER_60: { label: "60-Day Reminder", color: "bg-orange-100 text-orange-700" },
  DEMAND_90: { label: "90-Day Demand", color: "bg-red-100 text-red-700" },
  COLLECTIONS: { label: "Collections", color: "bg-red-200 text-red-800" },
};

export default function AgingPage() {
  const summaryQuery = trpc.aging.getSummary.useQuery();
  const queueQuery = trpc.aging.getEscalationQueue.useQuery();
  const escalateMut = trpc.aging.escalateInvoice.useMutation();
  const processAllMut = trpc.aging.processAllDue.useMutation();

  const summary = summaryQuery.data;
  const queue = queueQuery.data;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="h-7 w-7 text-orange-600" />
            Aging Receivables
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track overdue invoices with automated escalation</p>
        </div>
        <Button onClick={() => processAllMut.mutate()} disabled={processAllMut.isLoading} className="gap-2">
          <Zap className="h-4 w-4" /> Process All Due
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summary.buckets.map((b, i) => (
            <Card key={b.label} className={cn("p-4 border-t-4", i === 0 ? "border-t-green-500" : i === 1 ? "border-t-yellow-500" : i === 2 ? "border-t-orange-500" : "border-t-red-500")}>
              <p className="text-2xl font-bold text-gray-900">${b.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500">{b.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{b.count} invoices</p>
            </Card>
          ))}
        </div>
      )}

      {queue && queue.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-orange-600 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Escalations Due
          </h2>
          <div className="space-y-2">
            {queue.map((item: any) => {
              const ns = stageLabels[item.nextStage] || stageLabels.NONE;
              return (
                <Card key={item.invoiceId} className="p-4 border-l-4 border-l-orange-500 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{item.invoiceNumber}</span>
                      <Badge className={cn("text-[10px]", ns.color)}>{ns.label}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.clientName} - {item.daysOverdue}d overdue - ${item.outstanding}</p>
                  </div>
                  <Button size="sm" className="gap-1 text-xs"
                    onClick={() => escalateMut.mutate({ invoiceId: item.invoiceId, stage: item.nextStage })}>
                    <Send className="h-3 w-3" /> Send
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {!summary && (
        <Card className="p-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-200 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No overdue invoices</p>
        </Card>
      )}
    </div>
  );
}
