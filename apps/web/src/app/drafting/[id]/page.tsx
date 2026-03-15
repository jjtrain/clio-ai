"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Save,
  Send,
  Sparkles,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Info,
  Check,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  SENT: "bg-purple-100 text-purple-700",
  SIGNED: "bg-green-100 text-green-700",
};

export default function DraftEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const draftId = params.id as string;
  const utils = trpc.useUtils();

  const { data: draft, isLoading } = trpc.drafting.getDraft.useQuery({ id: draftId });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [improveInstructions, setImproveInstructions] = useState("");
  const [changes, setChanges] = useState<string[]>([]);

  // Signature fields
  const [sigClientName, setSigClientName] = useState("");
  const [sigClientEmail, setSigClientEmail] = useState("");
  const [showSignatureForm, setShowSignatureForm] = useState(false);

  useEffect(() => {
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
    }
  }, [draft]);

  const updateDraft = trpc.drafting.updateDraft.useMutation({
    onSuccess: () => {
      toast({ title: "Saved" });
      utils.drafting.getDraft.invalidate({ id: draftId });
    },
  });
  const improveDraft = trpc.drafting.improveDraft.useMutation({
    onSuccess: (data) => {
      toast({ title: "Document improved" });
      setChanges(data.changes);
      utils.drafting.getDraft.invalidate({ id: draftId });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteDraft = trpc.drafting.deleteDraft.useMutation({
    onSuccess: () => { toast({ title: "Deleted" }); router.push("/drafting"); },
  });
  const duplicateDraft = trpc.drafting.duplicateDraft.useMutation({
    onSuccess: (d) => { toast({ title: "Duplicated" }); router.push(`/drafting/${d.id}`); },
  });
  const sendForSignature = trpc.drafting.sendForSignature.useMutation({
    onSuccess: () => {
      toast({ title: "Sent for signature" });
      setShowSignatureForm(false);
      utils.drafting.getDraft.invalidate({ id: draftId });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => updateDraft.mutate({ id: draftId, title, content });
  const handleStatusChange = (status: string) => updateDraft.mutate({ id: draftId, status: status as any });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!draft) return <div className="py-20 text-center text-gray-500">Draft not found</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/drafting"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold border-none shadow-none p-0 h-auto flex-1"
        />
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[draft.status]}`}>
          {draft.status}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)} title={showPreview ? "Edit HTML" : "Preview"}>
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSidebar(!showSidebar)}>
            <Info className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => duplicateDraft.mutate({ id: draftId })}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this draft?")) deleteDraft.mutate({ id: draftId }); }}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
          <Button onClick={handleSave} disabled={updateDraft.isPending} className="bg-rose-600 hover:bg-rose-700 ml-2" size="sm">
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document Editor/Preview */}
        <div className="flex-1 overflow-y-auto">
          {showPreview ? (
            <div className="max-w-4xl mx-auto p-8">
              <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-8 prose prose-sm max-w-none min-h-[600px]" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          ) : (
            <div className="p-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-sm min-h-[80vh]"
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 border-l border-gray-100 bg-gray-50 overflow-y-auto p-4 space-y-5 shrink-0">
            {/* Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Document Info</h3>
              <div className="space-y-2 text-sm">
                {draft.matter && (
                  <div>
                    <span className="text-gray-500">Matter:</span>
                    <Link href={`/matters/${draft.matter.id}`} className="ml-1 text-rose-600 hover:underline">
                      {draft.matter.matterNumber}
                    </Link>
                  </div>
                )}
                {draft.client && (
                  <div>
                    <span className="text-gray-500">Client:</span>
                    <span className="ml-1">{draft.client.name}</span>
                  </div>
                )}
                {draft.template && (
                  <div>
                    <span className="text-gray-500">Template:</span>
                    <span className="ml-1">{draft.template.name}</span>
                  </div>
                )}
                <div><span className="text-gray-500">Version:</span> <span className="ml-1">{draft.version}</span></div>
                <div><span className="text-gray-500">Created:</span> <span className="ml-1">{new Date(draft.createdAt).toLocaleDateString()}</span></div>
                {draft.aiGenerated && (
                  <div className="flex items-center gap-1 text-purple-600">
                    <Sparkles className="h-3 w-3" /> AI Generated
                  </div>
                )}
              </div>
            </div>

            {/* AI Prompt (if AI generated) */}
            {draft.aiPrompt && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">AI Prompt</h3>
                <p className="text-xs text-gray-600 bg-white rounded p-2 border border-gray-200">{draft.aiPrompt}</p>
              </div>
            )}

            {/* Improve with AI */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Improve with AI</h3>
              <Textarea
                value={improveInstructions}
                onChange={(e) => setImproveInstructions(e.target.value)}
                rows={3}
                placeholder='e.g. "Make the language more formal" or "Add a confidentiality clause"'
                className="text-xs mb-2"
              />
              <Button
                size="sm"
                onClick={() => improveDraft.mutate({ id: draftId, instructions: improveInstructions })}
                disabled={!improveInstructions.trim() || improveDraft.isPending}
                className="bg-purple-600 hover:bg-purple-700 w-full"
              >
                {improveDraft.isPending ? (
                  <><Sparkles className="h-3 w-3 mr-1 animate-spin" /> Improving...</>
                ) : (
                  <><Sparkles className="h-3 w-3 mr-1" /> Apply Improvements</>
                )}
              </Button>
              {changes.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500">Changes made:</p>
                  {changes.map((c, i) => (
                    <div key={i} className="flex items-start gap-1 text-xs text-gray-600">
                      <Check className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Actions */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Status Actions</h3>
              <div className="space-y-2">
                {draft.status === "DRAFT" && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => handleStatusChange("REVIEW")}>
                    Mark as Review
                  </Button>
                )}
                {draft.status === "REVIEW" && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => handleStatusChange("APPROVED")}>
                    Approve
                  </Button>
                )}
                {(draft.status === "DRAFT" || draft.status === "REVIEW" || draft.status === "APPROVED") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowSignatureForm(!showSignatureForm)}
                  >
                    <Send className="h-3 w-3 mr-1" /> Send for Signature
                  </Button>
                )}
                {showSignatureForm && (
                  <div className="bg-white rounded border border-gray-200 p-3 space-y-2">
                    <Input value={sigClientName} onChange={(e) => setSigClientName(e.target.value)} placeholder="Client name" className="h-8 text-xs" />
                    <Input value={sigClientEmail} onChange={(e) => setSigClientEmail(e.target.value)} placeholder="Client email" type="email" className="h-8 text-xs" />
                    <Button
                      size="sm"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-xs"
                      onClick={() => sendForSignature.mutate({ draftId, clientName: sigClientName, clientEmail: sigClientEmail })}
                      disabled={!sigClientName || !sigClientEmail || sendForSignature.isPending}
                    >
                      {sendForSignature.isPending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
