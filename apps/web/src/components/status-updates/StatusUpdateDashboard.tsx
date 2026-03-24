"use client";

import { useState } from "react";
import { Send, Clock, CheckCircle, AlertTriangle, RefreshCw, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { UpdateQueueCard } from "./UpdateQueueCard";

const filterChips = ["All Pending", "Phase Changes", "Deadline Events", "Court Events", "Check-Ins"];

export function StatusUpdateDashboard() {
  const [activeFilter, setActiveFilter] = useState("All Pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: stats } = trpc.statusUpdates.getQueueStats.useQuery();
  const { data: queue, refetch } = trpc.statusUpdates.getUpdateQueue.useQuery({});
  const { data: recentAuto } = trpc.statusUpdates.getUpdateQueue.useQuery({ status: "auto_published", limit: 10 });
  const { data: analytics } = trpc.statusUpdates.getUpdateAnalytics.useQuery();

  const bulkApprove = trpc.statusUpdates.bulkApprove.useMutation({ onSuccess: () => { refetch(); setSelectedIds(new Set()); } });
  const generateCheckins = trpc.statusUpdates.generateBulkCheckins.useMutation({ onSuccess: () => refetch() });

  const filteredQueue = queue?.filter((item) => {
    if (activeFilter === "All Pending") return true;
    if (activeFilter === "Phase Changes") return item.triggerSource === "phase_change";
    if (activeFilter === "Deadline Events") return item.triggerSource.includes("deadline");
    if (activeFilter === "Court Events") return item.triggerSource === "court_event_completed";
    if (activeFilter === "Check-Ins") return item.triggerSource === "inactivity";
    return true;
  }) || [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Send className="h-7 w-7 text-blue-600" />
            Client Status Updates
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve AI-generated updates before they reach your clients
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => generateCheckins.mutate({})}
          disabled={generateCheckins.isLoading}
          className="gap-2"
        >
          <Sparkles className={cn("h-4 w-4", generateCheckins.isLoading && "animate-pulse")} />
          Generate Check-Ins
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-xs text-gray-500">Pending Approval</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.autoPublishedToday}</p>
                <p className="text-xs text-gray-500">Auto-Published Today</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics?.delivered || 0}</p>
                <p className="text-xs text-gray-500">Total Delivered</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{analytics?.approvalRate || 100}%</p>
                <p className="text-xs text-gray-500">Approval Rate</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filter + Bulk Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {filterChips.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
                activeFilter === chip ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {chip}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <Button
            size="sm"
            onClick={() => bulkApprove.mutate({ queueItemIds: Array.from(selectedIds) })}
            disabled={bulkApprove.isLoading}
            className="gap-1.5"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve {selectedIds.size} Selected
          </Button>
        )}
      </div>

      {/* Approval Queue */}
      {filteredQueue.length > 0 ? (
        <div className="space-y-3">
          {filteredQueue.map((item) => (
            <UpdateQueueCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onUpdate={() => refetch()}
            />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">All caught up!</p>
          <p className="text-xs text-gray-400 mt-1">No pending updates to review</p>
        </Card>
      )}

      {/* Recent Auto-Published */}
      {recentAuto && recentAuto.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recently Auto-Published</h2>
          <div className="space-y-2">
            {recentAuto.slice(0, 5).map((item) => (
              <Card key={item.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className="text-[10px] bg-green-100 text-green-700 flex-shrink-0">Auto</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500">
                      {item.triggerSource.replace(/_/g, " ")} · {item.deliveredAt ? new Date(item.deliveredAt).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
                {item.practiceArea && (
                  <Badge variant="secondary" className="text-[10px] flex-shrink-0 capitalize">
                    {item.practiceArea.replace(/_/g, " ")}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
