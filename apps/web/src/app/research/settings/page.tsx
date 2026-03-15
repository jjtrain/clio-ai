"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";

export default function ResearchSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = trpc.research.getSettings.useQuery();

  const [defaultJurisdiction, setDefaultJurisdiction] = useState("Federal");
  const [defaultModel, setDefaultModel] = useState("claude-sonnet-4-20250514");
  const [vlexEnabled, setVlexEnabled] = useState(false);
  const [vlexApiKey, setVlexApiKey] = useState("");

  useEffect(() => {
    if (settings) {
      setDefaultJurisdiction(settings.defaultJurisdiction);
      setDefaultModel(settings.defaultModel);
      setVlexEnabled(settings.vlexEnabled);
      setVlexApiKey(settings.vlexApiKey || "");
    }
  }, [settings]);

  const updateSettings = trpc.research.updateSettings.useMutation({
    onSuccess: () => toast({ title: "Settings saved" }),
  });

  const handleSave = () => {
    updateSettings.mutate({
      defaultJurisdiction,
      defaultModel,
      vlexEnabled,
      vlexApiKey: vlexApiKey || undefined,
    });
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/research"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Research Settings</h1>
          <p className="text-gray-500">Configure legal research preferences</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Default Jurisdiction */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Default Jurisdiction</Label>
          <p className="text-xs text-gray-500">The default jurisdiction for legal research queries</p>
          <Select value={defaultJurisdiction} onValueChange={setDefaultJurisdiction}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Federal">Federal</SelectItem>
              <SelectItem value="Alabama">Alabama</SelectItem>
              <SelectItem value="Alaska">Alaska</SelectItem>
              <SelectItem value="Arizona">Arizona</SelectItem>
              <SelectItem value="Arkansas">Arkansas</SelectItem>
              <SelectItem value="California">California</SelectItem>
              <SelectItem value="Colorado">Colorado</SelectItem>
              <SelectItem value="Connecticut">Connecticut</SelectItem>
              <SelectItem value="Delaware">Delaware</SelectItem>
              <SelectItem value="Florida">Florida</SelectItem>
              <SelectItem value="Georgia">Georgia</SelectItem>
              <SelectItem value="Hawaii">Hawaii</SelectItem>
              <SelectItem value="Idaho">Idaho</SelectItem>
              <SelectItem value="Illinois">Illinois</SelectItem>
              <SelectItem value="Indiana">Indiana</SelectItem>
              <SelectItem value="Iowa">Iowa</SelectItem>
              <SelectItem value="Kansas">Kansas</SelectItem>
              <SelectItem value="Kentucky">Kentucky</SelectItem>
              <SelectItem value="Louisiana">Louisiana</SelectItem>
              <SelectItem value="Maine">Maine</SelectItem>
              <SelectItem value="Maryland">Maryland</SelectItem>
              <SelectItem value="Massachusetts">Massachusetts</SelectItem>
              <SelectItem value="Michigan">Michigan</SelectItem>
              <SelectItem value="Minnesota">Minnesota</SelectItem>
              <SelectItem value="Mississippi">Mississippi</SelectItem>
              <SelectItem value="Missouri">Missouri</SelectItem>
              <SelectItem value="Montana">Montana</SelectItem>
              <SelectItem value="Nebraska">Nebraska</SelectItem>
              <SelectItem value="Nevada">Nevada</SelectItem>
              <SelectItem value="New Hampshire">New Hampshire</SelectItem>
              <SelectItem value="New Jersey">New Jersey</SelectItem>
              <SelectItem value="New Mexico">New Mexico</SelectItem>
              <SelectItem value="New York">New York</SelectItem>
              <SelectItem value="North Carolina">North Carolina</SelectItem>
              <SelectItem value="North Dakota">North Dakota</SelectItem>
              <SelectItem value="Ohio">Ohio</SelectItem>
              <SelectItem value="Oklahoma">Oklahoma</SelectItem>
              <SelectItem value="Oregon">Oregon</SelectItem>
              <SelectItem value="Pennsylvania">Pennsylvania</SelectItem>
              <SelectItem value="Rhode Island">Rhode Island</SelectItem>
              <SelectItem value="South Carolina">South Carolina</SelectItem>
              <SelectItem value="South Dakota">South Dakota</SelectItem>
              <SelectItem value="Tennessee">Tennessee</SelectItem>
              <SelectItem value="Texas">Texas</SelectItem>
              <SelectItem value="Utah">Utah</SelectItem>
              <SelectItem value="Vermont">Vermont</SelectItem>
              <SelectItem value="Virginia">Virginia</SelectItem>
              <SelectItem value="Washington">Washington</SelectItem>
              <SelectItem value="West Virginia">West Virginia</SelectItem>
              <SelectItem value="Wisconsin">Wisconsin</SelectItem>
              <SelectItem value="Wyoming">Wyoming</SelectItem>
              <SelectItem value="District of Columbia">District of Columbia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <hr className="border-gray-100" />

        {/* AI Model */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">AI Model</Label>
          <p className="text-xs text-gray-500">Select which Claude model to use for legal research</p>
          <Select value={defaultModel} onValueChange={setDefaultModel}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</SelectItem>
              <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Faster)</SelectItem>
              <SelectItem value="claude-opus-4-6">Claude Opus 4.6 (Most Capable)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <hr className="border-gray-100" />

        {/* vLex Integration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">vLex Integration</Label>
              <p className="text-xs text-gray-500 mt-0.5">Connect to vLex for enhanced legal research (coming soon)</p>
            </div>
            <button
              onClick={() => setVlexEnabled(!vlexEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                vlexEnabled ? "bg-indigo-600" : "bg-gray-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                vlexEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
          {vlexEnabled && (
            <div className="space-y-2">
              <Label className="text-xs">vLex API Key</Label>
              <Input
                type="password"
                value={vlexApiKey}
                onChange={(e) => setVlexApiKey(e.target.value)}
                placeholder="Enter your vLex API key"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="bg-indigo-600 hover:bg-indigo-700">
          <Save className="h-4 w-4 mr-2" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
