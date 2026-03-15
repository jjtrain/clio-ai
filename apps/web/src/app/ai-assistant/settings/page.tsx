"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

export default function AiAssistantSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = trpc.aiAssistant.getSettings.useQuery();

  const [isEnabled, setIsEnabled] = useState(true);
  const [autoExtractDeadlines, setAutoExtractDeadlines] = useState(false);
  const [autoSuggestTasks, setAutoSuggestTasks] = useState(false);
  const [aiModel, setAiModel] = useState("claude-sonnet-4-20250514");

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setAutoExtractDeadlines(settings.autoExtractDeadlines);
      setAutoSuggestTasks(settings.autoSuggestTasks);
      setAiModel(settings.aiModel);
    }
  }, [settings]);

  const updateSettings = trpc.aiAssistant.updateSettings.useMutation({
    onSuccess: () => toast({ title: "Settings saved" }),
  });

  const handleSave = () => {
    updateSettings.mutate({ isEnabled, autoExtractDeadlines, autoSuggestTasks, aiModel });
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/ai-assistant"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">AI Assistant Settings</h1>
          <p className="text-gray-500">Configure AI behavior and preferences</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Enable AI Assistant</Label>
            <p className="text-xs text-gray-500 mt-0.5">Turn the AI assistant on or off globally</p>
          </div>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isEnabled ? "bg-purple-600" : "bg-gray-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isEnabled ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>

        <hr className="border-gray-100" />

        {/* AI Model */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">AI Model</Label>
          <p className="text-xs text-gray-500">Select which Claude model to use for AI actions</p>
          <Select value={aiModel} onValueChange={setAiModel}>
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

        {/* Auto-Extract Deadlines */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Auto-Extract Deadlines</Label>
            <p className="text-xs text-gray-500 mt-0.5">Automatically extract deadlines when documents are uploaded</p>
          </div>
          <button
            onClick={() => setAutoExtractDeadlines(!autoExtractDeadlines)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoExtractDeadlines ? "bg-purple-600" : "bg-gray-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autoExtractDeadlines ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>

        {/* Auto-Suggest Tasks */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Auto-Suggest Tasks</Label>
            <p className="text-xs text-gray-500 mt-0.5">Automatically suggest tasks after matter activity</p>
          </div>
          <button
            onClick={() => setAutoSuggestTasks(!autoSuggestTasks)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoSuggestTasks ? "bg-purple-600" : "bg-gray-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autoSuggestTasks ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="bg-purple-600 hover:bg-purple-700">
          <Save className="h-4 w-4 mr-2" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
