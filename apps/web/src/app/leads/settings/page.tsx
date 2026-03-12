"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Copy } from "lucide-react";

export default function LeadSettingsPage() {
  const { toast } = useToast();
  const { data: settings, refetch } = trpc.chat.getSettings.useQuery();

  const [isEnabled, setIsEnabled] = useState(false);
  const [widgetColor, setWidgetColor] = useState("#3B82F6");
  const [widgetPosition, setWidgetPosition] = useState("bottom-right");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");
  const [practiceAreas, setPracticeAreas] = useState("");
  const [autoCreateLead, setAutoCreateLead] = useState(true);
  const [showOfflineForm, setShowOfflineForm] = useState(true);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setWidgetColor(settings.widgetColor);
      setWidgetPosition(settings.widgetPosition);
      setWelcomeMessage(settings.welcomeMessage || "");
      setOfflineMessage(settings.offlineMessage || "");
      setAiEnabled(settings.aiEnabled);
      setAiSystemPrompt(settings.aiSystemPrompt || "");
      setPracticeAreas(
        Array.isArray(settings.practiceAreas) ? settings.practiceAreas.join("\n") : ""
      );
      setAutoCreateLead(settings.autoCreateLead);
      setShowOfflineForm(settings.showOfflineForm);
    }
  }, [settings]);

  const updateMutation = trpc.chat.updateSettings.useMutation({
    onSuccess: () => {
      toast({ title: "Settings saved" });
      refetch();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    updateMutation.mutate({
      isEnabled,
      widgetColor,
      widgetPosition,
      welcomeMessage: welcomeMessage || undefined,
      offlineMessage: offlineMessage || undefined,
      aiEnabled,
      aiSystemPrompt: aiSystemPrompt || undefined,
      practiceAreas: practiceAreas
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      autoCreateLead,
      showOfflineForm,
    });
  };

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leads"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Lead & Chat Settings</h1>
          <p className="text-gray-500 text-sm">Configure the chat widget and contact form</p>
        </div>
      </div>

      {/* Chat Widget Settings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Chat Widget</h2>

        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Chat Widget</Label>
            <p className="text-sm text-gray-500">Allow visitors to chat on your website</p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Widget Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={widgetColor}
                onChange={(e) => setWidgetColor(e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer"
              />
              <Input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="bg-white" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Widget Position</Label>
            <Select value={widgetPosition} onValueChange={setWidgetPosition}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Welcome Message</Label>
          <Textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} placeholder="Hello! How can we help you today?" className="bg-white" />
        </div>

        <div className="space-y-2">
          <Label>Offline Message</Label>
          <Textarea value={offlineMessage} onChange={(e) => setOfflineMessage(e.target.value)} placeholder="We're currently offline. Please leave a message." className="bg-white" />
        </div>
      </div>

      {/* AI Settings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-medium text-gray-900">AI Assistant</h2>

        <div className="flex items-center justify-between">
          <div>
            <Label>Enable AI Responses</Label>
            <p className="text-sm text-gray-500">Let AI handle initial conversations</p>
          </div>
          <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
        </div>

        <div className="space-y-2">
          <Label>AI System Prompt</Label>
          <Textarea
            value={aiSystemPrompt}
            onChange={(e) => setAiSystemPrompt(e.target.value)}
            placeholder="Custom instructions for the AI chatbot. Leave blank to use the default."
            className="bg-white"
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <Label>Practice Areas (one per line)</Label>
          <Textarea
            value={practiceAreas}
            onChange={(e) => setPracticeAreas(e.target.value)}
            placeholder="Family Law&#10;Criminal Defense&#10;Personal Injury"
            className="bg-white"
            rows={4}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-create Lead</Label>
            <p className="text-sm text-gray-500">Automatically create a lead when chat starts</p>
          </div>
          <Switch checked={autoCreateLead} onCheckedChange={setAutoCreateLead} />
        </div>
      </div>

      {/* Embed Code */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Embed Code</h2>

        <div className="space-y-2">
          <Label>Chat Widget Script</Label>
          <div className="flex gap-2">
            <code className="flex-1 bg-gray-50 px-3 py-2 rounded text-sm text-gray-700 overflow-x-auto">
              {`<script src="${appUrl}/widget/chat.js" data-firm-id="default"></script>`}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyText(`<script src="${appUrl}/widget/chat.js" data-firm-id="default"></script>`)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Contact Form Embed</Label>
          <div className="flex gap-2">
            <code className="flex-1 bg-gray-50 px-3 py-2 rounded text-sm text-gray-700 overflow-x-auto">
              {`<iframe src="${appUrl}/widget/contact" width="100%" height="500" frameborder="0"></iframe>`}
            </code>
            <Button variant="outline" size="sm" onClick={() => copyText(`<iframe src="${appUrl}/widget/contact" width="100%" height="500" frameborder="0"></iframe>`)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleSave} disabled={updateMutation.isLoading}>
          {updateMutation.isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
