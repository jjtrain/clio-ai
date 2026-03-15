"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Calendar,
  Mail,
  Receipt,
  FileText,
  CheckSquare,
  Settings,
  Check,
  X,
  Zap,
  Clock,
  AlertCircle,
} from "lucide-react";

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  DEADLINE_EXTRACTION: { label: "Deadline", icon: Calendar, color: "bg-red-100 text-red-700" },
  CLIENT_UPDATE_DRAFT: { label: "Client Update", icon: Mail, color: "bg-blue-100 text-blue-700" },
  TIME_TO_INVOICE: { label: "Invoice", icon: Receipt, color: "bg-green-100 text-green-700" },
  MATTER_SUMMARY: { label: "Summary", icon: FileText, color: "bg-purple-100 text-purple-700" },
  TASK_SUGGESTION: { label: "Task", icon: CheckSquare, color: "bg-amber-100 text-amber-700" },
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  APPLIED: "bg-green-100 text-green-700",
};

export default function AiAssistantPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: stats } = trpc.aiAssistant.getStats.useQuery();
  const { data: actions, isLoading } = trpc.aiAssistant.listActions.useQuery({ limit: 50 });
  const { data: matters } = trpc.matters.list.useQuery();

  const [showQuickAction, setShowQuickAction] = useState<string | null>(null);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [docName, setDocName] = useState("");
  const [docText, setDocText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const extractDeadlines = trpc.aiAssistant.extractDeadlines.useMutation({
    onSuccess: (data) => {
      toast({ title: `Extracted ${data.count} deadline(s)` });
      utils.aiAssistant.listActions.invalidate();
      utils.aiAssistant.getStats.invalidate();
      setShowQuickAction(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const draftUpdate = trpc.aiAssistant.draftClientUpdate.useMutation({
    onSuccess: () => {
      toast({ title: "Client update drafted" });
      utils.aiAssistant.listActions.invalidate();
      utils.aiAssistant.getStats.invalidate();
      setShowQuickAction(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const generateInvoice = trpc.aiAssistant.generateInvoice.useMutation({
    onSuccess: () => {
      toast({ title: "Invoice draft generated" });
      utils.aiAssistant.listActions.invalidate();
      utils.aiAssistant.getStats.invalidate();
      setShowQuickAction(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const summarize = trpc.aiAssistant.summarizeMatter.useMutation({
    onSuccess: () => {
      toast({ title: "Matter summary generated" });
      utils.aiAssistant.listActions.invalidate();
      utils.aiAssistant.getStats.invalidate();
      setShowQuickAction(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const suggestTasks = trpc.aiAssistant.suggestTasks.useMutation({
    onSuccess: (data) => {
      toast({ title: `Suggested ${data.count} task(s)` });
      utils.aiAssistant.listActions.invalidate();
      utils.aiAssistant.getStats.invalidate();
      setShowQuickAction(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveAction = trpc.aiAssistant.approveAction.useMutation({
    onSuccess: () => { utils.aiAssistant.listActions.invalidate(); utils.aiAssistant.getStats.invalidate(); },
  });
  const rejectAction = trpc.aiAssistant.rejectAction.useMutation({
    onSuccess: () => { utils.aiAssistant.listActions.invalidate(); utils.aiAssistant.getStats.invalidate(); },
  });
  const applyAction = trpc.aiAssistant.applyAction.useMutation({
    onSuccess: () => {
      toast({ title: "Action applied" });
      utils.aiAssistant.listActions.invalidate();
      utils.aiAssistant.getStats.invalidate();
    },
  });

  const isGenerating = extractDeadlines.isPending || draftUpdate.isPending || generateInvoice.isPending || summarize.isPending || suggestTasks.isPending;

  const filteredActions = actions?.filter((a) => statusFilter === "ALL" || a.status === statusFilter) || [];

  const quickActions = [
    { id: "deadlines", label: "Extract Deadlines", icon: Calendar, color: "text-red-600", needsDoc: true },
    { id: "update", label: "Draft Client Update", icon: Mail, color: "text-blue-600" },
    { id: "invoice", label: "Generate Invoice", icon: Receipt, color: "text-green-600" },
    { id: "summary", label: "Summarize Matter", icon: FileText, color: "text-purple-600" },
    { id: "tasks", label: "Suggest Tasks", icon: CheckSquare, color: "text-amber-600" },
  ];

  const handleQuickAction = () => {
    if (!selectedMatterId) return;
    switch (showQuickAction) {
      case "deadlines":
        if (!docName || !docText) return;
        extractDeadlines.mutate({ matterId: selectedMatterId, documentName: docName, documentText: docText });
        break;
      case "update":
        draftUpdate.mutate({ matterId: selectedMatterId });
        break;
      case "invoice":
        generateInvoice.mutate({ matterId: selectedMatterId });
        break;
      case "summary":
        summarize.mutate({ matterId: selectedMatterId });
        break;
      case "tasks":
        suggestTasks.mutate({ matterId: selectedMatterId });
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">AI Assistant</h1>
              <p className="text-gray-500">AI-powered practice management tools</p>
            </div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/ai-assistant/settings"><Settings className="h-4 w-4 mr-2" /> Settings</Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Pending Review</span>
          </div>
          <p className="text-2xl font-bold">{stats?.pending || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Check className="h-4 w-4" />
            <span className="text-sm font-medium">Approved</span>
          </div>
          <p className="text-2xl font-bold">{stats?.approved || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Applied</span>
          </div>
          <p className="text-2xl font-bold">{stats?.applied || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">This Week</span>
          </div>
          <p className="text-2xl font-bold">{stats?.recentWeek || 0}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {quickActions.map((qa) => (
            <button
              key={qa.id}
              onClick={() => { setShowQuickAction(qa.id); setSelectedMatterId(""); setDocName(""); setDocText(""); }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors ${
                showQuickAction === qa.id ? "border-purple-500 bg-purple-50" : ""
              }`}
            >
              <qa.icon className={`h-6 w-6 ${qa.color}`} />
              <span className="text-xs font-medium text-gray-700">{qa.label}</span>
            </button>
          ))}
        </div>

        {/* Quick Action Dialog */}
        {showQuickAction && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {quickActions.find((q) => q.id === showQuickAction)?.label}
              </h3>
              <button onClick={() => setShowQuickAction(null)}>
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Select Matter</Label>
              <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a matter..." />
                </SelectTrigger>
                <SelectContent>
                  {matters?.matters?.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.matterNumber} - {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showQuickAction === "deadlines" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Document Name</Label>
                  <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Court Order - Filing Deadline" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Document Text</Label>
                  <Textarea value={docText} onChange={(e) => setDocText(e.target.value)} rows={6} placeholder="Paste document text here..." />
                </div>
              </>
            )}
            <Button
              onClick={handleQuickAction}
              disabled={!selectedMatterId || isGenerating || (showQuickAction === "deadlines" && (!docName || !docText))}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" /> Generate
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Actions List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">AI Actions</h2>
          <div className="flex gap-2">
            {["ALL", "PENDING", "APPROVED", "APPLIED", "REJECTED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-purple-100 text-purple-700"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filteredActions.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No AI actions yet</h3>
            <p className="text-gray-500">Use the quick actions above to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredActions.map((action) => {
              const typeConfig = ACTION_TYPE_LABELS[action.type] || { label: action.type, icon: Sparkles, color: "bg-gray-100 text-gray-700" };
              const TypeIcon = typeConfig.icon;
              return (
                <div key={action.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-gray-900">{action.title}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_STYLES[action.status]}`}>
                          {action.status}
                        </span>
                      </div>
                      {action.matter && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Link href={`/matters/${action.matter.id}`} className="hover:underline">
                            {action.matter.matterNumber} - {action.matter.name}
                          </Link>
                        </p>
                      )}
                      {action.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2 whitespace-pre-line">{action.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(action.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {action.status === "PENDING" && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => approveAction.mutate({ id: action.id })}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => rejectAction.mutate({ id: action.id })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {action.status === "APPROVED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyAction.mutate({ id: action.id })}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <Zap className="h-3 w-3 mr-1" /> Apply
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
