"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Send,
  AlertCircle,
  Loader2,
  Eye,
  Pencil,
  FileText,
} from "lucide-react";

const SET_STATUS_COLORS: Record<string, string> = {
  ASSEMBLING: "bg-gray-100 text-gray-600",
  READY: "bg-blue-100 text-blue-700",
  SENT: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
};

const DRAFT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  SENT: "bg-purple-100 text-purple-700",
  SIGNED: "bg-green-100 text-green-700",
};

const GENERATION_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
  GENERATING: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  COMPLETED: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  PARTIAL: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  FAILED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

export default function DocumentSetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const setId = params.id as string;
  const utils = trpc.useUtils();

  const { data: docSet, isLoading } = trpc.drafting.getSet.useQuery({ id: setId });
  const { data: drafts } = trpc.drafting.listDrafts.useQuery();

  const [showAddItem, setShowAddItem] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDraftId, setAddDraftId] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const addItem = trpc.drafting.addItemToSet.useMutation({
    onSuccess: () => { toast({ title: "Item added" }); utils.drafting.getSet.invalidate({ id: setId }); setShowAddItem(false); setAddTitle(""); setAddDraftId(""); },
  });
  const removeItem = trpc.drafting.removeItemFromSet.useMutation({
    onSuccess: () => utils.drafting.getSet.invalidate({ id: setId }),
  });
  const markComplete = trpc.drafting.markItemComplete.useMutation({
    onSuccess: () => utils.drafting.getSet.invalidate({ id: setId }),
  });
  const updateSetStatus = trpc.drafting.updateSetStatus.useMutation({
    onSuccess: () => { toast({ title: "Status updated" }); utils.drafting.getSet.invalidate({ id: setId }); },
  });
  const deleteSet = trpc.drafting.deleteSet.useMutation({
    onSuccess: () => { toast({ title: "Set deleted" }); router.push("/drafting"); },
  });
  const aiSuggest = trpc.drafting.aiSuggestSet.useMutation({
    onSuccess: () => setShowSuggestions(true),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const regenerateDoc = trpc.drafting.regenerateDocument.useMutation({
    onSuccess: () => { toast({ title: "Document regenerated" }); utils.drafting.getSet.invalidate({ id: setId }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const approveSet = trpc.drafting.approveSet.useMutation({
    onSuccess: () => { toast({ title: "Set approved" }); utils.drafting.getSet.invalidate({ id: setId }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const sendForSignature = trpc.drafting.sendSetForSignature.useMutation({
    onSuccess: (data) => { toast({ title: `Sent ${data.sent} documents for signature` }); utils.drafting.getSet.invalidate({ id: setId }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!docSet) return <div className="py-20 text-center text-gray-500">Document set not found</div>;

  const complete = docSet.items.filter((i) => i.isComplete).length;
  const total = docSet.items.length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  const gen = (docSet as any).generation;
  const genColors = gen ? GENERATION_STATUS_COLORS[gen.status] || GENERATION_STATUS_COLORS.PENDING : null;
  const hasFailed = gen && gen.failedDocuments > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{docSet.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {docSet.matter && (
                <Link href={`/matters/${docSet.matter.id}`} className="text-rose-600 hover:underline">
                  {docSet.matter.matterNumber} - {docSet.matter.name}
                </Link>
              )}
              <span>{complete} of {total} complete</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SET_STATUS_COLORS[docSet.status]}`}>
            {docSet.status}
          </span>
          <Select value={docSet.status} onValueChange={(val) => updateSetStatus.mutate({ id: setId, status: val as any })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ASSEMBLING">Assembling</SelectItem>
              <SelectItem value="READY">Ready</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this set?")) deleteSet.mutate({ id: setId }); }}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Generation Status Banner */}
      {gen && (
        <div className={`rounded-xl border ${genColors?.border} ${genColors?.bg} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {gen.status === "GENERATING" && <Loader2 className={`h-5 w-5 ${genColors?.text} animate-spin`} />}
              {gen.status === "COMPLETED" && <CheckCircle2 className={`h-5 w-5 ${genColors?.text}`} />}
              {gen.status === "APPROVED" && <CheckCircle2 className={`h-5 w-5 ${genColors?.text}`} />}
              {gen.status === "PARTIAL" && <AlertCircle className={`h-5 w-5 ${genColors?.text}`} />}
              {gen.status === "FAILED" && <AlertCircle className={`h-5 w-5 ${genColors?.text}`} />}
              {gen.status === "PENDING" && <Loader2 className={`h-5 w-5 ${genColors?.text}`} />}
              <div>
                <p className={`font-medium text-sm ${genColors?.text}`}>
                  {gen.status === "GENERATING" && "Generating documents..."}
                  {gen.status === "COMPLETED" && "All documents generated successfully"}
                  {gen.status === "APPROVED" && "Document set approved"}
                  {gen.status === "PARTIAL" && `Generated with ${gen.failedDocuments} failed document(s)`}
                  {gen.status === "FAILED" && "Generation failed"}
                  {gen.status === "PENDING" && "Generation pending"}
                </p>
                <p className="text-xs text-gray-500">
                  {gen.completedDocuments} of {gen.totalDocuments} documents completed
                  {gen.generatedAt && ` · Generated ${new Date(gen.generatedAt).toLocaleString()}`}
                  {gen.approvedAt && ` · Approved ${new Date(gen.approvedAt).toLocaleString()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasFailed && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    const failedItems = docSet.items.filter((i) => !i.draftDocument);
                    failedItems.forEach((item) => {
                      regenerateDoc.mutate({ documentSetItemId: item.id });
                    });
                  }}
                  disabled={regenerateDoc.isPending}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate Failed
                </Button>
              )}
              {(gen.status === "COMPLETED" || gen.status === "PARTIAL") && gen.status !== "APPROVED" && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => approveSet.mutate({ documentSetId: setId })}
                  disabled={approveSet.isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {approveSet.isPending ? "Approving..." : "Approve Set"}
                </Button>
              )}
              {gen.status === "APPROVED" && (
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => {
                    const clientName = prompt("Client name for signature:");
                    if (!clientName) return;
                    const clientEmail = prompt("Client email for signature:");
                    if (!clientEmail) return;
                    sendForSignature.mutate({ documentSetId: setId, clientName, clientEmail });
                  }}
                  disabled={sendForSignature.isPending}
                >
                  <Send className="h-3 w-3 mr-1" /> {sendForSignature.isPending ? "Sending..." : "Send All for Signature"}
                </Button>
              )}
            </div>
          </div>
          {/* Generation progress bar */}
          {gen.totalDocuments > 0 && (
            <div className="mt-3">
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${gen.status === "FAILED" ? "bg-red-400" : gen.status === "PARTIAL" ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.round((gen.completedDocuments / gen.totalDocuments) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">Progress</span>
          <span className="text-gray-500">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setShowAddItem(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Document
        </Button>
        {docSet.matter && (
          <Button variant="outline" onClick={() => aiSuggest.mutate({ matterId: docSet.matter!.id })} disabled={aiSuggest.isPending}>
            <Sparkles className="h-4 w-4 mr-2" /> {aiSuggest.isPending ? "Suggesting..." : "AI Suggest Documents"}
          </Button>
        )}
      </div>

      {/* Add Item Form */}
      {showAddItem && (
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Document title" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link to Existing Draft (optional)</Label>
              <Select value={addDraftId} onValueChange={setAddDraftId}>
                <SelectTrigger><SelectValue placeholder="Select draft..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked draft</SelectItem>
                  {drafts?.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => addItem.mutate({
              documentSetId: setId,
              title: addTitle,
              draftDocumentId: addDraftId && addDraftId !== "none" ? addDraftId : undefined,
            })} disabled={!addTitle.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {showSuggestions && aiSuggest.data && (
        <div className="bg-white rounded-xl border border-purple-200 shadow-sm p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" /> AI Suggested Documents</h3>
          <div className="space-y-2">
            {(aiSuggest.data as any[]).map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.description}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => addItem.mutate({ documentSetId: setId, title: s.title })}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowSuggestions(false)} className="mt-2">Dismiss</Button>
        </div>
      )}

      {/* Items List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {docSet.items.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No documents in this set</h3>
            <p className="text-gray-500">Add documents to start assembling your set</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {docSet.items.map((item) => (
              <div key={item.id}>
                <div className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50">
                  <button onClick={() => markComplete.mutate({ id: item.id })} className="shrink-0">
                    {item.isComplete ? (
                      <CheckSquare className="h-5 w-5 text-green-500" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-300 hover:text-gray-500" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${item.isComplete ? "text-gray-400 line-through" : "text-gray-900"}`}>
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.draftDocument && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DRAFT_STATUS_COLORS[item.draftDocument.status]}`}>
                          {item.draftDocument.status}
                        </span>
                      )}
                      {gen && !item.draftDocument && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                          Generation Failed
                        </span>
                      )}
                      {(item.draftDocument as any)?.template && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <FileText className="h-2.5 w-2.5" /> {(item.draftDocument as any).template?.name || "Template"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.draftDocument && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewItemId(previewItemId === item.id ? null : item.id)}
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild title="Edit">
                          <Link href={`/drafting/${item.draftDocument.id}`}><Pencil className="h-3.5 w-3.5 text-gray-400" /></Link>
                        </Button>
                      </>
                    )}
                    {gen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateDoc.mutate({ documentSetItemId: item.id })}
                        disabled={regenerateDoc.isPending}
                        title="Regenerate"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${regenerateDoc.isPending ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                    {item.draftDocument && (
                      <Button variant="ghost" size="sm" asChild title="Open">
                        <Link href={`/drafting/${item.draftDocument.id}`}><ExternalLink className="h-3 w-3" /></Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => removeItem.mutate({ id: item.id })}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
                {/* Inline Preview */}
                {previewItemId === item.id && item.draftDocument && (
                  <div className="px-6 pb-4">
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: (item.draftDocument as any).content || "<p class='text-gray-400'>No content</p>" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
