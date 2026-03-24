"use client";

import { ClipboardList, AlertTriangle, CheckCircle, Clock, FileText, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = { CRITICAL: "bg-red-100 text-red-700", HIGH: "bg-orange-100 text-orange-700", STANDARD: "bg-gray-100 text-gray-600", OPTIONAL: "bg-blue-100 text-blue-600" };
const statusColors: Record<string, string> = { PENDING: "bg-gray-100 text-gray-600", IN_PROGRESS: "bg-blue-100 text-blue-700", SERVED: "bg-cyan-100 text-cyan-700", RESPONDED: "bg-green-100 text-green-700", DEFICIENT: "bg-red-100 text-red-600", COMPLETE: "bg-emerald-100 text-emerald-700", WAIVED: "bg-gray-100 text-gray-400" };

export function DiscoveryDashboard() {
  const { data: stats } = trpc.discoveryChecklists.getStats.useQuery();
  const { data: checklists } = trpc.discoveryChecklists.getChecklists.useQuery({});
  const { data: overdue } = trpc.discoveryChecklists.getOverdueItems.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-blue-600" />
          Discovery Checklists
        </h1>
        <p className="text-sm text-gray-500 mt-1">Auto-generated discovery checklists with AI supplementation</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.activeChecklists}</p><p className="text-xs text-gray-500">Active Checklists</p></Card>
          <Card className="p-4"><p className={cn("text-2xl font-bold", stats.overdueItems > 0 ? "text-red-600" : "")}>{stats.overdueItems}</p><p className="text-xs text-gray-500">Overdue Items</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-green-600">{stats.respondedThisWeek}</p><p className="text-xs text-gray-500">Responses This Week</p></Card>
          <Card className="p-4"><p className={cn("text-2xl font-bold", stats.deficientResponses > 0 ? "text-orange-600" : "")}>{stats.deficientResponses}</p><p className="text-xs text-gray-500">Deficient Responses</p></Card>
        </div>
      )}

      {/* Overdue Items */}
      {overdue && overdue.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Overdue Items ({overdue.length})
          </h2>
          <div className="space-y-1.5">
            {overdue.slice(0, 5).map((item) => (
              <Card key={item.id} className="p-3 border-l-4 border-l-red-500 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.checklist?.title} · Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "N/A"}</p>
                </div>
                <Badge className={cn("text-[10px]", priorityColors[item.priority])}>{item.priority}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Checklists */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Checklists</h2>
        {checklists && checklists.length > 0 ? (
          <div className="space-y-2">
            {checklists.map((cl) => (
              <Card key={cl.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{cl.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] capitalize">{cl.practiceArea.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{cl.caseType.replace(/_/g, " ")}</Badge>
                      <Badge className={cn("text-[10px]", cl.generatedFrom === "hybrid" ? "bg-purple-100 text-purple-700" : cl.generatedFrom === "ai" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600")}>
                        {cl.generatedFrom === "hybrid" ? "Template + AI" : cl.generatedFrom}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", cl.completionPct >= 66 ? "bg-green-500" : cl.completionPct >= 33 ? "bg-yellow-500" : "bg-red-500")}
                          style={{ width: `${cl.completionPct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{cl.completionPct}%</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{cl._count.items} items</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No discovery checklists yet</p>
            <p className="text-xs text-gray-400 mt-1">Generate one from a matter's Discovery tab</p>
          </Card>
        )}
      </div>
    </div>
  );
}
