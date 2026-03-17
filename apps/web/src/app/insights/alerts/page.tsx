"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, RefreshCw, AlertCircle, AlertTriangle, Info, CheckCircle, XCircle,
  Bell, Eye, EyeOff, Search,
} from "lucide-react";

const SEVERITY_ICONS: Record<string, any> = { CRITICAL: AlertCircle, WARNING: AlertTriangle, INFO: Info };
const SEVERITY_COLORS: Record<string, string> = { CRITICAL: "text-red-500 bg-red-50 border-red-200", WARNING: "text-amber-500 bg-amber-50 border-amber-200", INFO: "text-blue-500 bg-blue-50 border-blue-200" };

export default function AlertsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<{ severity?: string; isRead?: boolean }>({});

  const { data: alerts, isLoading } = trpc.finInsights["alerts.list"].useQuery({
    severity: filter.severity as any,
    isRead: filter.isRead,
    isDismissed: false,
  });

  const checkMut = trpc.finInsights["alerts.check"].useMutation({
    onSuccess: (data) => { utils.finInsights["alerts.list"].invalidate(); toast({ title: `${data.length} alert(s) generated` }); },
  });
  const markReadMut = trpc.finInsights["alerts.markRead"].useMutation({ onSuccess: () => utils.finInsights["alerts.list"].invalidate() });
  const dismissMut = trpc.finInsights["alerts.dismiss"].useMutation({ onSuccess: () => utils.finInsights["alerts.list"].invalidate() });

  const criticalCount = (alerts || []).filter((a: any) => a.severity === "CRITICAL" && !a.isRead).length;
  const warningCount = (alerts || []).filter((a: any) => a.severity === "WARNING" && !a.isRead).length;
  const infoCount = (alerts || []).filter((a: any) => a.severity === "INFO" && !a.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Alerts</h1>
          <p className="text-sm text-slate-500">Monitor financial health and take action</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => checkMut.mutate()} disabled={checkMut.isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${checkMut.isLoading ? "animate-spin" : ""}`} />
          Check Now
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div><p className="text-2xl font-bold">{criticalCount}</p><p className="text-xs text-gray-500">Critical</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div><p className="text-2xl font-bold">{warningCount}</p><p className="text-xs text-gray-500">Warnings</p></div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6 flex items-center gap-3">
            <Info className="h-8 w-8 text-blue-500" />
            <div><p className="text-2xl font-bold">{infoCount}</p><p className="text-xs text-gray-500">Info</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={filter.severity || "all"} onValueChange={(v) => setFilter({ ...filter, severity: v === "all" ? undefined : v })}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={filter.isRead === false ? "default" : "outline"} size="sm" onClick={() => setFilter({ ...filter, isRead: filter.isRead === false ? undefined : false })}>
          <EyeOff className="h-4 w-4 mr-1" /> Unread Only
        </Button>
      </div>

      {/* Alert List */}
      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <div className="space-y-3">
          {(alerts || []).map((alert: any) => {
            const Icon = SEVERITY_ICONS[alert.severity] || Info;
            const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.INFO;
            return (
              <Card key={alert.id} className={`border ${colors} ${!alert.isRead ? "ring-1 ring-offset-1" : "opacity-75"}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{alert.title}</h3>
                        <span className="text-xs text-gray-400">{new Date(alert.createdAt).toLocaleDateString()}</span>
                        {alert.alertType && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{alert.alertType.replace(/_/g, " ")}</span>}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                      {alert.metric && (
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Metric: {alert.metric}</span>
                          {alert.currentValue && <span>Current: {Number(alert.currentValue).toLocaleString()}</span>}
                          {alert.thresholdValue && <span>Threshold: {Number(alert.thresholdValue).toLocaleString()}</span>}
                        </div>
                      )}
                      {alert.recommendation && (
                        <div className="mt-2 p-2 bg-white rounded text-xs text-blue-700">
                          <strong>Recommendation:</strong> {alert.recommendation}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!alert.isRead && (
                        <Button variant="ghost" size="sm" onClick={() => markReadMut.mutate({ id: alert.id })} title="Mark as read">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => dismissMut.mutate({ id: alert.id })} title="Dismiss">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!alerts || alerts.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No alerts. Click "Check Now" to scan for financial issues.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
