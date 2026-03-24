"use client";

import { Layers, DollarSign, FileText, TrendingUp, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

const modelIcons: Record<string, string> = { flat_fee: "\uD83D\uDCB5", hourly: "\u23F1\uFE0F", contingency: "\uD83D\uDCC8", capped_hourly: "\uD83D\uDD12", subscription: "\uD83D\uDCC5", no_charge: "\uD83D\uDEAB" };
const modelColors: Record<string, string> = { flat_fee: "bg-green-100 text-green-700", hourly: "bg-blue-100 text-blue-700", contingency: "bg-purple-100 text-purple-700", capped_hourly: "bg-orange-100 text-orange-700", subscription: "bg-cyan-100 text-cyan-700" };

export function FeeStructureHub() {
  const { data: templates } = trpc.feeStructure.getTemplates.useQuery({});
  const { data: distribution } = trpc.feeStructure.getFeeModelDistribution.useQuery();
  const { data: templateUsage } = trpc.feeStructure.getTemplateUsage.useQuery();

  const grouped = templates?.reduce<Record<string, typeof templates>>((acc, t) => {
    const pa = t.practiceArea || "General";
    if (!acc[pa]) acc[pa] = [];
    acc[pa].push(t);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-blue-600" />
            Fee Structures
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage billing templates, hybrid fee models, and per-matter structures</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Template</Button>
      </div>

      {/* Distribution */}
      {distribution && Object.keys(distribution).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(distribution).map(([model, count]) => (
            <Card key={model} className="p-3 text-center">
              <span className="text-xl">{modelIcons[model] || "\uD83D\uDCCB"}</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
              <p className="text-[10px] text-gray-500 capitalize">{model.replace(/_/g, " ")}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Templates by Practice Area */}
      {Object.entries(grouped).map(([pa, temps]) => (
        <div key={pa}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2 capitalize">{pa.replace(/_/g, " ")}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {temps?.map((t) => {
              const phases = (t.phases as any[]) || [];
              const models = Array.from(new Set(phases.map((p: any) => p.billingModel)));
              const estimate = t.totalEstimate as any;
              return (
                <Card key={t.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      {t.caseType && <p className="text-[10px] text-gray-400 capitalize">{t.caseType.replace(/_/g, " ")}</p>}
                    </div>
                    {t.isDefault && <Badge className="text-[10px] bg-yellow-100 text-yellow-700">Default</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    {models.map((m) => (
                      <Badge key={m} className={`text-[10px] ${modelColors[m] || "bg-gray-100 text-gray-600"}`}>
                        {modelIcons[m]} {m.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{phases.length} phase{phases.length !== 1 ? "s" : ""}</p>
                  {estimate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Est: ${estimate.low?.toLocaleString()} — ${estimate.high?.toLocaleString()}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {(!templates || templates.length === 0) && (
        <Card className="p-8 text-center">
          <Layers className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No fee structure templates yet</p>
          <Button className="mt-3 gap-2" size="sm"><Plus className="h-3.5 w-3.5" /> Create First Template</Button>
        </Card>
      )}
    </div>
  );
}
