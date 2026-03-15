"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FilePen,
  Plus,
  FileText,
  Sparkles,
  File,
  Trash2,
  Copy,
  Layers,
  ChevronDown,
  Search,
  Pencil,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  ENGAGEMENT: "bg-blue-100 text-blue-700",
  PLEADING: "bg-purple-100 text-purple-700",
  MOTION: "bg-amber-100 text-amber-700",
  LETTER: "bg-teal-100 text-teal-700",
  AGREEMENT: "bg-emerald-100 text-emerald-700",
  DISCOVERY: "bg-orange-100 text-orange-700",
  COURT_FORM: "bg-slate-100 text-slate-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  SENT: "bg-purple-100 text-purple-700",
  SIGNED: "bg-green-100 text-green-700",
};

const SET_STATUS_COLORS: Record<string, string> = {
  ASSEMBLING: "bg-gray-100 text-gray-600",
  READY: "bg-blue-100 text-blue-700",
  SENT: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
};

export default function DraftingHub() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"drafts" | "templates" | "sets">("drafts");
  const [draftStatusFilter, setDraftStatusFilter] = useState("ALL");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: drafts, isLoading: loadingDrafts } = trpc.drafting.listDrafts.useQuery(
    { status: draftStatusFilter !== "ALL" ? draftStatusFilter as any : undefined, search: searchQuery || undefined }
  );
  const { data: templates, isLoading: loadingTemplates } = trpc.drafting.listTemplates.useQuery(
    { category: templateCategoryFilter !== "ALL" ? templateCategoryFilter as any : undefined, search: searchQuery || undefined }
  );
  const { data: sets, isLoading: loadingSets } = trpc.drafting.listSets.useQuery();

  const deleteDraft = trpc.drafting.deleteDraft.useMutation({
    onSuccess: () => { toast({ title: "Draft deleted" }); utils.drafting.listDrafts.invalidate(); },
  });
  const deleteTemplate = trpc.drafting.deleteTemplate.useMutation({
    onSuccess: () => { toast({ title: "Template archived" }); utils.drafting.listTemplates.invalidate(); },
  });
  const duplicateTemplate = trpc.drafting.duplicateTemplate.useMutation({
    onSuccess: () => { toast({ title: "Template duplicated" }); utils.drafting.listTemplates.invalidate(); },
  });

  const tabs = [
    { id: "drafts" as const, label: "Drafts", count: drafts?.length },
    { id: "templates" as const, label: "Templates", count: templates?.length },
    { id: "sets" as const, label: "Document Sets", count: sets?.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
            <FilePen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Document Drafting</h1>
            <p className="text-gray-500">Templates, AI drafting, and document sets</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-rose-600 hover:bg-rose-700">
              <Plus className="h-4 w-4 mr-2" /> New Document <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/drafting/new?mode=template"><FileText className="mr-2 h-4 w-4" /> From Template</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/drafting/new?mode=ai"><Sparkles className="mr-2 h-4 w-4" /> AI Generate</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/drafting/new?mode=blank"><File className="mr-2 h-4 w-4" /> Blank Document</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearchQuery(""); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-rose-600 text-rose-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* Drafts Tab */}
      {tab === "drafts" && (
        <>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search drafts..." className="pl-9" />
            </div>
            <Select value={draftStatusFilter} onValueChange={setDraftStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="REVIEW">Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="SIGNED">Signed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingDrafts ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : !drafts || drafts.length === 0 ? (
              <div className="p-12 text-center">
                <FilePen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No drafts yet</h3>
                <p className="text-gray-500">Create a document from a template, AI, or start blank</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Title</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Matter</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Source</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Modified</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link href={`/drafting/${d.id}`} className="font-medium text-gray-900 hover:text-rose-600">
                          {d.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {d.matter ? `${d.matter.matterNumber} - ${d.matter.name}` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500">
                        {d.aiGenerated ? (
                          <span className="flex items-center gap-1 text-purple-600"><Sparkles className="h-3 w-3" /> AI Generated</span>
                        ) : d.template ? (
                          <span>{d.template.name}</span>
                        ) : "Blank"}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400">
                        {new Date(d.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => {
                          if (confirm("Delete this draft?")) deleteDraft.mutate({ id: d.id });
                        }}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search templates..." className="pl-9" />
            </div>
            <Select value={templateCategoryFilter} onValueChange={setTemplateCategoryFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {Object.keys(CATEGORY_COLORS).map((c) => (
                  <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild className="bg-rose-600 hover:bg-rose-700 text-white"><Link href="/drafting/builder"><Pencil className="h-4 w-4 mr-1" /> Template Builder</Link></Button>
            <Button variant="outline" asChild><Link href="/drafting/templates/new">Create Template</Link></Button>
            <Button variant="outline" asChild><Link href="/drafting/templates/new?ai=1"><Sparkles className="h-4 w-4 mr-1" /> AI Create</Link></Button>
          </div>

          {loadingTemplates ? (
            <div className="py-12 text-center text-gray-400">Loading...</div>
          ) : !templates || templates.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No templates yet</h3>
              <p className="text-gray-500">Templates will be auto-created on first load</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 group hover:border-rose-200 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <Link href={`/drafting/templates/${t.id}`} className="font-semibold text-gray-900 hover:text-rose-600 line-clamp-1">{t.name}</Link>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => duplicateTemplate.mutate({ id: t.id })} className="p-1 text-gray-400 hover:text-gray-600" title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { if (confirm("Archive this template?")) deleteTemplate.mutate({ id: t.id }); }} className="p-1 text-gray-400 hover:text-red-500" title="Archive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category]}`}>
                      {t.category.replace("_", " ")}
                    </span>
                    {t.practiceArea && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t.practiceArea}</span>
                    )}
                  </div>
                  {t.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{t.description}</p>}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Used {t.usageCount} times</span>
                    <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Document Sets Tab */}
      {tab === "sets" && (
        <>
          <div className="flex gap-3">
            <Button variant="outline" asChild><Link href="/drafting/sets/new"><Layers className="h-4 w-4 mr-2" /> New Document Set</Link></Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingSets ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : !sets || sets.length === 0 ? (
              <div className="p-12 text-center">
                <Layers className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No document sets</h3>
                <p className="text-gray-500">Group related documents into sets for organized case preparation</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sets.map((s) => {
                  const complete = s.items.filter((i: any) => i.isComplete).length;
                  const total = s.items.length;
                  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
                  return (
                    <Link key={s.id} href={`/drafting/sets/${s.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-400">
                          {s.matter ? `${s.matter.matterNumber} - ${s.matter.name}` : "No linked matter"} · {total} items
                        </p>
                      </div>
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{complete}/{total}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SET_STATUS_COLORS[s.status]}`}>
                        {s.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
