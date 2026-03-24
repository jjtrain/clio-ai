"use client";

import { useState } from "react";
import { Zap, DollarSign, Clock, Send, CheckCircle, ArrowRight, RefreshCw, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function QuickInvoiceApp() {
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [sent, setSent] = useState<any>(null);

  const { data: stats } = trpc.quickInvoice.getStats.useQuery();
  const { data: candidates, refetch } = trpc.quickInvoice.getCandidates.useQuery({});
  const { data: presets } = trpc.quickInvoice.getPresets.useQuery();
  const { data: history } = trpc.quickInvoice.getQuickInvoices.useQuery({ limit: 5 });
  const refreshMutation = trpc.quickInvoice.refreshCandidates.useMutation({ onSuccess: () => refetch() });
  const invoiceMutation = trpc.quickInvoice.generateQuickInvoice.useMutation({
    onSuccess: (data) => { setSent(data); refetch(); },
  });

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-sm text-center bg-gray-800 border-gray-700">
          <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Invoice Sent!</h2>
          <p className="text-2xl font-bold text-green-400 mb-2">${sent.amountDue.toLocaleString()}</p>
          <p className="text-sm text-gray-400 mb-1">{sent.clientName}</p>
          {sent.generatedInSeconds && (
            <p className="text-xs text-gray-500 mb-4">Generated in {sent.generatedInSeconds} seconds</p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => setSent(null)} className="flex-1 bg-blue-600 hover:bg-blue-700">Invoice Another</Button>
            <Button variant="outline" onClick={() => setSent(null)} className="flex-1 border-gray-600 text-gray-300">Done</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-yellow-400" />
          <h1 className="text-lg font-bold">Quick Invoice</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refreshMutation.mutate()} className="text-gray-400">
          <RefreshCw className={cn("h-4 w-4", refreshMutation.isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-6">
          <Card className="p-3 bg-gray-800 border-gray-700 text-center">
            <p className="text-lg font-bold text-yellow-400">${(stats.totalUnbilled / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-gray-500">Unbilled</p>
          </Card>
          <Card className="p-3 bg-gray-800 border-gray-700 text-center">
            <p className="text-lg font-bold text-green-400">{stats.oneTapReady}</p>
            <p className="text-[10px] text-gray-500">One-Tap Ready</p>
          </Card>
          <Card className="p-3 bg-gray-800 border-gray-700 text-center">
            <p className="text-lg font-bold text-blue-400">{stats.avgSeconds}s</p>
            <p className="text-[10px] text-gray-500">Avg Speed</p>
          </Card>
        </div>
      )}

      {/* Pinned Presets */}
      {presets && presets.filter((p) => p.isPinned).length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Presets</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {presets.filter((p) => p.isPinned).map((preset) => (
              <Card
                key={preset.id}
                className="p-3 bg-gray-800 border-gray-700 flex-shrink-0 w-44 cursor-pointer hover:bg-gray-750"
                onClick={() => preset.matterId && invoiceMutation.mutate({ matterId: preset.matterId, presetId: preset.id })}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Star className="h-3 w-3 text-yellow-400" />
                  <p className="text-xs font-medium text-white truncate">{preset.name}</p>
                </div>
                <Badge className="text-[10px] bg-gray-700 text-gray-300">{preset.presetType.replace(/_/g, " ")}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Invoice Candidates */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Ready to Invoice ({candidates?.length || 0})</p>
        <div className="space-y-2">
          {candidates?.slice(0, 10).map((c) => (
            <Card
              key={c.id}
              className={cn("p-4 bg-gray-800 border-gray-700 cursor-pointer transition-all", c.isOneTapReady && "border-l-4 border-l-green-500")}
              onClick={() => invoiceMutation.mutate({ matterId: c.matterId })}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{c.clientName || c.matterName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.practiceArea && <Badge className="text-[10px] bg-gray-700 text-gray-300 capitalize">{c.practiceArea.replace(/_/g, " ")}</Badge>}
                    <span className="text-[10px] text-gray-500">{c.unbilledHours.toFixed(1)}h · {c.daysSinceLastInvoice}d ago</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-white">${c.unbilledAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  {c.isOneTapReady ? (
                    <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Send className="h-4 w-4 text-green-400" />
                    </div>
                  ) : (
                    <ArrowRight className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </div>
              {c.trustBalance > 0 && (
                <p className="text-[10px] text-blue-400 mt-1">Retainer: ${c.trustBalance.toLocaleString()}</p>
              )}
            </Card>
          ))}
          {(!candidates || candidates.length === 0) && (
            <Card className="p-8 bg-gray-800 border-gray-700 text-center">
              <CheckCircle className="h-10 w-10 text-green-400/30 mx-auto mb-2" />
              <p className="text-sm text-gray-500">All caught up!</p>
            </Card>
          )}
        </div>
      </div>

      {/* Recent */}
      {history && history.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recent</p>
          <div className="space-y-1.5">
            {history.map((qi) => (
              <div key={qi.id} className="flex items-center justify-between py-2 border-b border-gray-800">
                <div>
                  <p className="text-sm text-gray-300">{qi.clientName}</p>
                  <p className="text-[10px] text-gray-500">{qi.sentAt ? new Date(qi.sentAt).toLocaleDateString() : ""} · {qi.generatedInSeconds}s</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">${qi.amountDue.toLocaleString()}</p>
                  <Badge className={cn("text-[10px]", qi.status === "paid" ? "bg-green-900 text-green-400" : qi.status === "sent" ? "bg-blue-900 text-blue-400" : "bg-gray-700 text-gray-400")}>{qi.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoiceMutation.isLoading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Zap className="h-12 w-12 text-yellow-400 animate-pulse mx-auto mb-3" />
            <p className="text-white font-medium">Generating invoice...</p>
          </div>
        </div>
      )}
    </div>
  );
}
