"use client";

import { useState } from "react";
import { Brain, Bell, CheckCircle, Clock, XCircle, Zap, TrendingUp, RefreshCw, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, string> = { BILLING_RUN: "\uD83D\uDCB0", FOLLOW_UP_DUE: "\uD83D\uDCCB", CLIENT_CHECKIN: "\uD83D\uDC64", DISCOVERY_FOLLOW_UP: "\uD83D\uDD0D", TIME_LOG_HABIT: "\u23F0", DEPOSITION_PREP: "\u2696\uFE0F", CUSTOM: "\uD83E\uDDE0" };
const statusColors: Record<string, string> = { PENDING: "bg-blue-100 text-blue-700", SENT: "bg-yellow-100 text-yellow-700", ACTED: "bg-green-100 text-green-700", DISMISSED: "bg-gray-100 text-gray-500", SNOOZED: "bg-purple-100 text-purple-600", EXPIRED: "bg-gray-100 text-gray-400" };

export function SmartRemindersHub() {
  const [tab, setTab] = useState<"reminders" | "patterns" | "settings">("reminders");
  const { data: stats } = trpc.smartReminders.getStats.useQuery();
  const { data: reminders, refetch: refetchReminders } = trpc.smartReminders.getReminders.useQuery({ status: "PENDING,SENT" });
  const { data: patterns, refetch: refetchPatterns } = trpc.smartReminders.getPatterns.useQuery({});
  const detectMutation = trpc.smartReminders.runDetection.useMutation({ onSuccess: () => refetchPatterns() });
  const respondMutation = trpc.smartReminders.respondToReminder.useMutation({ onSuccess: () => refetchReminders() });
  const updatePattern = trpc.smartReminders.updatePattern.useMutation({ onSuccess: () => refetchPatterns() });

  const shownPatterns = patterns?.filter((p) => p.status === "SHOWN") || [];
  const activePatterns = patterns?.filter((p) => p.status === "ACTIVE" || p.status === "CONFIRMED") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-7 w-7 text-purple-600" />
            Smart Reminders
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI learns your work patterns and reminds you at the right time</p>
        </div>
        <Button variant="outline" onClick={() => detectMutation.mutate()} disabled={detectMutation.isLoading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", detectMutation.isLoading && "animate-spin")} /> Detect Patterns
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.totalPatterns}</p><p className="text-xs text-gray-500">Patterns Detected</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-green-600">{stats.activePatterns}</p><p className="text-xs text-gray-500">Active Reminders</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-purple-600">{stats.remindersActedOnRate}%</p><p className="text-xs text-gray-500">Action Rate</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-yellow-600">{stats.suggestedPatterns}</p><p className="text-xs text-gray-500">New Suggestions</p></Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(["reminders", "patterns", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize", tab === t ? "border-purple-600 text-purple-600" : "border-transparent text-gray-500 hover:text-gray-700")}>{t}</button>
        ))}
      </div>

      {/* Reminders Tab */}
      {tab === "reminders" && (
        <div className="space-y-3">
          {reminders && reminders.length > 0 ? reminders.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{typeIcons[r.reminderType] || "\uD83D\uDD14"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                    <Badge className={cn("text-[10px]", statusColors[r.status])}>{r.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{r.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(r.scheduledFor).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {r.actionUrl && (
                    <Button size="sm" className="text-xs h-7 gap-1" onClick={() => respondMutation.mutate({ reminderId: r.id, response: "acted" })}>
                      <Zap className="h-3 w-3" /> {r.actionLabel || "Do It"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => respondMutation.mutate({ reminderId: r.id, response: "dismissed" })}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          )) : (
            <Card className="p-8 text-center">
              <Bell className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No upcoming reminders</p>
              <p className="text-xs text-gray-400 mt-1">{stats?.activePatterns || 0} patterns are learning from your habits</p>
            </Card>
          )}
        </div>
      )}

      {/* Patterns Tab */}
      {tab === "patterns" && (
        <div className="space-y-4">
          {/* Suggested */}
          {shownPatterns.length > 0 && (
            <div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-yellow-800">We detected {shownPatterns.length} new pattern{shownPatterns.length > 1 ? "s" : ""} — do {shownPatterns.length > 1 ? "these" : "this"} look right?</p>
              </div>
              {shownPatterns.map((p) => (
                <Card key={p.id} className="p-4 border-l-4 border-l-yellow-400">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${p.confidenceScore * 100}%` }} /></div>
                        <span className="text-[10px] text-gray-400">{Math.round(p.confidenceScore * 100)}% confident · {p.occurrenceCount} times</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs h-7 bg-green-600" onClick={() => updatePattern.mutate({ patternId: p.id, status: "ACTIVE", reminderEnabled: true })}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Yes, remind me
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => updatePattern.mutate({ patternId: p.id, status: "DISMISSED" })}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Active */}
          {activePatterns.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Patterns</h3>
              {activePatterns.map((p) => (
                <Card key={p.id} className="p-3 mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.label}</p>
                    <span className="text-[10px] text-gray-400">{Math.round(p.confidenceScore * 100)}% confident · Reminding {p.reminderOffsetHours || 2}h before</span>
                  </div>
                  <Badge className="text-[10px] bg-green-100 text-green-700">Active</Badge>
                </Card>
              ))}
            </div>
          )}

          {(!patterns || patterns.length === 0) && (
            <Card className="p-8 text-center">
              <Brain className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No patterns detected yet</p>
              <p className="text-xs text-gray-400 mt-1">Keep using Managal and we'll learn your habits</p>
              <Button variant="outline" className="mt-3 gap-2" onClick={() => detectMutation.mutate()}>
                <RefreshCw className="h-4 w-4" /> Run Detection Now
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Smart Reminder Settings</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Smart reminders enabled</span>
              <Badge className="text-xs bg-green-100 text-green-700">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Minimum confidence threshold</span>
              <span className="text-sm text-gray-500">65%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Default reminder lead time</span>
              <span className="text-sm text-gray-500">2 hours</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Delivery channels</span>
              <span className="text-sm text-gray-500">In-App, Push</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
