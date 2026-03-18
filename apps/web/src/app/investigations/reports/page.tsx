"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Users, Eye, FileText, BarChart3 } from "lucide-react";

export default function InvestigationReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(now.toISOString().split("T")[0]);

  const { data: stats, isLoading } = trpc.investigations.reports.overview.useQuery({});
  const { data: searchHistory } = trpc.investigations.reports.searchHistory.useQuery({ from, to });
  const { data: monitoringSummary } = trpc.investigations.reports.monitoringSummary.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Investigation Reports</h1><p className="text-sm text-slate-500">Usage analytics and investigation summaries</p></div>
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center"><Search className="h-6 w-6 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{stats.totalSearches}</p><p className="text-xs text-gray-500">Total Searches</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><Users className="h-6 w-6 mx-auto mb-1 text-green-500" /><p className="text-2xl font-bold">{stats.totalPersonRecords}</p><p className="text-xs text-gray-500">Persons Found</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><Eye className="h-6 w-6 mx-auto mb-1 text-purple-500" /><p className="text-2xl font-bold">{stats.totalVisualMatches}</p><p className="text-xs text-gray-500">Visual Matches</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><BarChart3 className="h-6 w-6 mx-auto mb-1 text-amber-500" /><p className="text-2xl font-bold">{stats.totalAlerts}</p><p className="text-xs text-gray-500">Alerts</p></CardContent></Card>
          </div>

          {stats.byType && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Searches by Type</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.byType).map(([type, count]: [string, any]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span>{type.replace(/_/g, " ")}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {monitoringSummary && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Monitoring Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-lg font-bold">{monitoringSummary.activeSubscriptions}</p><p className="text-xs text-gray-500">Active Subscriptions</p></div>
              <div><p className="text-lg font-bold">{monitoringSummary.totalAlerts}</p><p className="text-xs text-gray-500">Total Alerts</p></div>
              <div><p className="text-lg font-bold">{monitoringSummary.unreadAlerts}</p><p className="text-xs text-gray-500">Unresolved</p></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
