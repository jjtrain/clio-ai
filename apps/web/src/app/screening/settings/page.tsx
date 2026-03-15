"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save } from "lucide-react";

export default function ScreeningSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = trpc.screening.getSettings.useQuery();

  const [isEnabled, setIsEnabled] = useState(true);
  const [autoScreenNewLeads, setAutoScreenNewLeads] = useState(true);
  const [autoScreenIntakeSubmissions, setAutoScreenIntakeSubmissions] = useState(true);
  const [minimumQualifyScore, setMinimumQualifyScore] = useState(50);
  const [autoDeclineScore, setAutoDeclineScore] = useState(20);
  const [notifyOnHighValue, setNotifyOnHighValue] = useState(true);
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [preferredAreas, setPreferredAreas] = useState("");
  const [geoRestrictions, setGeoRestrictions] = useState("");
  const [conflictKeywords, setConflictKeywords] = useState("");

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setAutoScreenNewLeads(settings.autoScreenNewLeads);
      setAutoScreenIntakeSubmissions(settings.autoScreenIntakeSubmissions);
      setMinimumQualifyScore(settings.minimumQualifyScore);
      setAutoDeclineScore(settings.autoDeclineScore);
      setNotifyOnHighValue(settings.notifyOnHighValue);
      setFollowUpEnabled(settings.followUpEnabled);
      if (settings.screeningCriteria) {
        try {
          const c = JSON.parse(settings.screeningCriteria);
          setPreferredAreas(c.preferredAreas?.join(", ") || "");
          setGeoRestrictions(c.geoRestrictions?.join(", ") || "");
          setConflictKeywords(c.conflictKeywords?.join(", ") || "");
        } catch {}
      }
    }
  }, [settings]);

  const updateSettings = trpc.screening.updateSettings.useMutation({
    onSuccess: () => toast({ title: "Settings saved" }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const criteria: any = {};
    if (preferredAreas.trim()) criteria.preferredAreas = preferredAreas.split(",").map((s) => s.trim()).filter(Boolean);
    if (geoRestrictions.trim()) criteria.geoRestrictions = geoRestrictions.split(",").map((s) => s.trim()).filter(Boolean);
    if (conflictKeywords.trim()) criteria.conflictKeywords = conflictKeywords.split(",").map((s) => s.trim()).filter(Boolean);

    updateSettings.mutate({
      isEnabled,
      autoScreenNewLeads,
      autoScreenIntakeSubmissions,
      minimumQualifyScore,
      autoDeclineScore,
      notifyOnHighValue,
      followUpEnabled,
      screeningCriteria: Object.keys(criteria).length > 0 ? JSON.stringify(criteria) : undefined,
    });
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-rose-600" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/screening"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Screening Settings</h1>
      </div>

      {/* AI Screening */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">AI Screening</h2>
        <Toggle value={isEnabled} onChange={setIsEnabled} label="Enable AI Screening" />
        <Toggle value={autoScreenNewLeads} onChange={setAutoScreenNewLeads} label="Auto-screen new leads" />
        <Toggle value={autoScreenIntakeSubmissions} onChange={setAutoScreenIntakeSubmissions} label="Auto-screen intake submissions" />
      </div>

      {/* Scoring Thresholds */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Scoring Thresholds</h2>
        <div className="space-y-2">
          <Label>Minimum Qualify Score: {minimumQualifyScore}</Label>
          <input
            type="range"
            min={0}
            max={100}
            value={minimumQualifyScore}
            onChange={(e) => setMinimumQualifyScore(parseInt(e.target.value))}
            className="w-full accent-rose-600"
          />
          <p className="text-xs text-gray-500">Leads scoring below this are graded D or F</p>
        </div>
        <div className="space-y-2">
          <Label>Auto-Decline Score: {autoDeclineScore}</Label>
          <input
            type="range"
            min={0}
            max={100}
            value={autoDeclineScore}
            onChange={(e) => setAutoDeclineScore(parseInt(e.target.value))}
            className="w-full accent-rose-600"
          />
          <p className="text-xs text-gray-500">Leads scoring below this are automatically declined</p>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <Toggle value={notifyOnHighValue} onChange={setNotifyOnHighValue} label="Notify on high-value leads (A-grade)" />
      </div>

      {/* Screening Criteria */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Screening Criteria</h2>
        <div className="space-y-2">
          <Label>Preferred Practice Areas (comma-separated)</Label>
          <Input value={preferredAreas} onChange={(e) => setPreferredAreas(e.target.value)} placeholder="Family Law, Personal Injury, Criminal Defense" />
        </div>
        <div className="space-y-2">
          <Label>Geographic Restrictions (comma-separated)</Label>
          <Input value={geoRestrictions} onChange={(e) => setGeoRestrictions(e.target.value)} placeholder="California, New York, Texas" />
        </div>
        <div className="space-y-2">
          <Label>Conflict Keywords (comma-separated)</Label>
          <Input value={conflictKeywords} onChange={(e) => setConflictKeywords(e.target.value)} placeholder="Smith Corp, Jane Doe, XYZ Inc" />
        </div>
      </div>

      {/* Follow-up */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Automated Follow-up</h2>
        <Toggle value={followUpEnabled} onChange={setFollowUpEnabled} label="Enable automated follow-ups" />
      </div>

      <Button onClick={handleSave} disabled={updateSettings.isPending} className="bg-rose-600 hover:bg-rose-700">
        <Save className="h-4 w-4 mr-2" /> {updateSettings.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
