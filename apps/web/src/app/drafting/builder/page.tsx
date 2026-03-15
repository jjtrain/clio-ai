"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pencil,
  Copy,
  FileText,
  Sparkles,
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

export default function TemplateBuilderHub() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const { data: templates } = trpc.drafting.listTemplates.useQuery(
    search || categoryFilter !== "ALL"
      ? { search: search || undefined, category: categoryFilter !== "ALL" ? (categoryFilter as any) : undefined }
      : undefined
  );

  const duplicate = trpc.drafting.duplicateTemplate.useMutation({
    onSuccess: (t) => { toast({ title: "Template duplicated" }); window.location.href = `/drafting/builder/${t.id}`; },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Template Builder</h1>
            <p className="text-sm text-gray-500">Visual editor with merge fields, version history, and live preview</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-rose-600 hover:bg-rose-700">
            <Link href="/drafting/templates/new"><Plus className="h-4 w-4 mr-2" /> Create Template</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/drafting/templates/new?ai=1"><Sparkles className="h-4 w-4 mr-2" /> AI Create</Link>
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {Object.keys(CATEGORY_COLORS).map((c) => (
              <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((t: any) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{t.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category]}`}>
                    {t.category.replace("_", " ")}
                  </span>
                  {t.practiceArea && (
                    <span className="text-[10px] text-gray-500">{t.practiceArea}</span>
                  )}
                </div>
              </div>
              <FileText className="h-5 w-5 text-gray-300 shrink-0" />
            </div>

            {t.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">{t.description}</p>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Used {t.usageCount}x</span>
              <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
              <Button size="sm" variant="outline" className="flex-1" asChild>
                <Link href={`/drafting/builder/${t.id}`}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit in Builder
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => duplicate.mutate({ id: t.id })}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {!templates?.length && (
        <div className="py-20 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No templates found</h3>
          <p className="text-gray-500">Templates will be auto-created on first load</p>
        </div>
      )}
    </div>
  );
}
