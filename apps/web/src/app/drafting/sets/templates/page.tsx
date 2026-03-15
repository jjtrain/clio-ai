"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Trash2,
  Copy,
  Search,
  Layers,
  Sparkles,
  FileText,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  litigation: "bg-purple-100 text-purple-700",
  corporate: "bg-blue-100 text-blue-700",
  "real-estate": "bg-emerald-100 text-emerald-700",
  "estate-planning": "bg-amber-100 text-amber-700",
  "family-law": "bg-pink-100 text-pink-700",
  general: "bg-gray-100 text-gray-700",
};

export default function SetTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const { data: templates, isLoading } = trpc.drafting.listSetTemplates.useQuery({
    practiceArea: categoryFilter !== "ALL" ? categoryFilter : undefined,
  });

  const deleteTemplate = trpc.drafting.deleteSetTemplate.useMutation({
    onSuccess: () => { toast({ title: "Template deleted" }); utils.drafting.listSetTemplates.invalidate(); },
  });
  const duplicateTemplate = trpc.drafting.duplicateSetTemplate.useMutation({
    onSuccess: () => { toast({ title: "Template duplicated" }); utils.drafting.listSetTemplates.invalidate(); },
  });

  const filtered = templates?.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Set Templates</h1>
            <p className="text-gray-500">Manage reusable document set templates</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/drafting/sets/templates/new"><Plus className="h-4 w-4 mr-2" /> New Template</Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {Object.keys(CATEGORY_COLORS).map((c) => (
              <SelectItem key={c} value={c}>{c.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Layers className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No set templates</h3>
          <p className="text-gray-500">Set templates will be auto-created when you first generate a document set</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const items = (() => { try { return JSON.parse(t.items as string); } catch { return []; } })();
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 group hover:border-rose-200 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <Link href={`/drafting/sets/templates/${t.id}`} className="font-semibold text-gray-900 hover:text-rose-600 line-clamp-1">
                    {t.name}
                  </Link>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => duplicateTemplate.mutate({ id: t.id })} className="p-1 text-gray-400 hover:text-gray-600" title="Duplicate">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (confirm("Delete this template?")) deleteTemplate.mutate({ id: t.id }); }} className="p-1 text-gray-400 hover:text-red-500" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {t.practiceArea && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.practiceArea] || "bg-gray-100 text-gray-600"}`}>
                      {t.practiceArea.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </span>
                  )}
                  {t.category && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {t.category}
                    </span>
                  )}
                </div>
                {t.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{t.description}</p>}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <FileText className="h-3 w-3" />
                  <span>{items.length} document{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Used {t.usageCount} times</span>
                  <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
