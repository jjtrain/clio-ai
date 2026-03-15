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

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!docSet) return <div className="py-20 text-center text-gray-500">Document set not found</div>;

  const complete = docSet.items.filter((i) => i.isComplete).length;
  const total = docSet.items.length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

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
              <div key={item.id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50">
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
                  {item.draftDocument && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DRAFT_STATUS_COLORS[item.draftDocument.status]}`}>
                      {item.draftDocument.status}
                    </span>
                  )}
                </div>
                {item.draftDocument && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/drafting/${item.draftDocument.id}`}><ExternalLink className="h-3 w-3" /></Link>
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => removeItem.mutate({ id: item.id })}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
