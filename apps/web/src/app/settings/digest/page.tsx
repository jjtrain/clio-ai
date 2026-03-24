"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  Mail,
  Clock,
  Globe,
  CheckCircle,
  Send,
  Loader2,
  History,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "deadlines", label: "Today's Deadlines", desc: "Matters with deadlines today or tomorrow" },
  { key: "tasks", label: "Overdue Tasks", desc: "Open tasks past their due date" },
  { key: "unbilled", label: "Unbilled Time", desc: "Yesterday's time entries without invoices" },
  { key: "hearings", label: "Upcoming Hearings", desc: "Court dates in the next 7 days" },
  { key: "payments", label: "Payments Received", desc: "Trust deposits and invoice payments from yesterday" },
  { key: "stats", label: "Quick Stats", desc: "Open matters, unbilled totals, collection rate" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const SEND_HOURS = [
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
];

export default function DigestSettingsPage() {
  const prefQuery = trpc.digest.getPreferences.useQuery();
  const historyQuery = trpc.digest.getDigestHistory.useQuery();
  const updateMut = trpc.digest.updatePreferences.useMutation({
    onSuccess: () => prefQuery.refetch(),
  });
  const testMut = trpc.digest.sendTestDigest.useMutation();

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const pref = prefQuery.data;
  const history = historyQuery.data || [];

  function toggleEnabled() {
    if (!pref) return;
    updateMut.mutate({ enabled: !pref.enabled });
  }

  function updateHour(hour: string) {
    updateMut.mutate({ sendHour: Number(hour) });
  }

  function updateTimezone(tz: string) {
    updateMut.mutate({ timezone: tz });
  }

  function toggleSection(key: string) {
    if (!pref) return;
    const sections = { ...(pref.sections as any) };
    sections[key] = !sections[key];
    updateMut.mutate({ sections });
  }

  function sendTest() {
    testMut.mutate(undefined, {
      onSuccess: (data) => {
        if (data.previewHtml) setPreviewHtml(data.previewHtml);
        historyQuery.refetch();
      },
    });
  }

  if (!pref) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const sections = (pref.sections || {}) as Record<string, boolean>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="h-7 w-7 text-blue-600" />
          Daily Digest
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Get a personalized morning summary delivered to your inbox
        </p>
      </div>

      {/* Enable/Disable */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Email Digest</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Receive a daily email with your tasks, deadlines, and financials
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              pref.enabled ? "bg-blue-600" : "bg-gray-300"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                pref.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </Card>

      {pref.enabled && (
        <>
          {/* Schedule */}
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" /> Schedule
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-600">Send Time</label>
                <Select value={String(pref.sendHour)} onValueChange={updateHour}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEND_HOURS.map((h) => (
                      <SelectItem key={h.value} value={String(h.value)}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Timezone
                </label>
                <Select value={pref.timezone} onValueChange={updateTimezone}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Sections */}
          <Card className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Sections to Include</h2>
            <div className="space-y-2">
              {SECTIONS.map((s) => {
                const enabled = sections[s.key] !== false;
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSection(s.key)}
                    className={cn(
                      "flex items-center justify-between w-full p-3 rounded-lg border text-left transition",
                      enabled
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-gray-100 bg-gray-50/50 opacity-60"
                    )}
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-800">{s.label}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    </div>
                    <div
                      className={cn(
                        "h-5 w-5 rounded border-2 flex items-center justify-center",
                        enabled ? "bg-blue-600 border-blue-600" : "border-gray-300"
                      )}
                    >
                      {enabled && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Test */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Test Digest</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Send yourself a test digest with live data right now
                </p>
              </div>
              <Button onClick={sendTest} disabled={testMut.isLoading} className="gap-2">
                {testMut.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Test Now
              </Button>
            </div>
            {testMut.isSuccess && testMut.data && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  Test digest sent with {testMut.data.sections} section(s)
                </p>
              </div>
            )}
          </Card>

          {/* Preview */}
          {previewHtml && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
                <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>
                  Close
                </Button>
              </div>
              <div
                className="border rounded-lg overflow-auto max-h-[600px]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </Card>
          )}

          {/* History */}
          {history.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-gray-400" /> Digest History
              </h2>
              <div className="space-y-2">
                {history.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {log.status === "sent" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm text-gray-700">
                        {new Date(log.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <Badge
                      className={cn(
                        "text-[10px]",
                        log.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
