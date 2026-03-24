"use client";

import { FileText, Plus, Zap, Code, BookOpen, Table2, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

const docTypeIcons: Record<string, string> = { retainer: "\uD83D\uDCDD", demand_letter: "\u2709\uFE0F", complaint: "\u2696\uFE0F", motion: "\uD83D\uDCCB", letter: "\u2709\uFE0F", agreement: "\uD83E\uDD1D", notice: "\uD83D\uDD14", affidavit: "\uD83D\uDCDC", subpoena: "\uD83D\uDCE8", custom: "\uD83D\uDCC4" };
const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-600", active: "bg-green-100 text-green-700", archived: "bg-red-100 text-red-500" };

export function AssemblyHub() {
  const { data: stats } = trpc.documentAssembly.getStats.useQuery();
  const { data: templates } = trpc.documentAssembly.getTemplates.useQuery({});
  const { data: documents } = trpc.documentAssembly.getDocuments.useQuery({ limit: 10 });
  const seedMutation = trpc.documentAssembly.seedDataSources.useMutation();

  const grouped = templates?.reduce<Record<string, typeof templates>>((acc, t) => {
    const pa = t.practiceArea || "General";
    if (!acc[pa]) acc[pa] = [];
    acc[pa].push(t);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-blue-600" />
            Document Assembly
          </h1>
          <p className="text-sm text-gray-500 mt-1">Rules-based template engine with conditional logic and merge fields</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedMutation.mutate()} className="gap-2"><Zap className="h-4 w-4" /> Seed Data Sources</Button>
          <Button className="gap-2"><Plus className="h-4 w-4" /> New Template</Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.templates}</p><p className="text-xs text-gray-500">Templates</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold">{stats.documents}</p><p className="text-xs text-gray-500">Documents</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold">{stats.snippets}</p><p className="text-xs text-gray-500">Snippets</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold">{stats.lookups}</p><p className="text-xs text-gray-500">Lookup Tables</p></Card>
        </div>
      )}

      {/* Templates by Practice Area */}
      {Object.entries(grouped).map(([pa, temps]) => (
        <div key={pa}>
          <h2 className="text-sm font-semibold text-gray-700 mb-2 capitalize">{pa.replace(/_/g, " ")}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {temps?.map((t) => (
              <Card key={t.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{docTypeIcons[t.documentType] || "\uD83D\uDCC4"}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className={cn("text-[10px]", statusColors[t.status] || "")}>{t.status}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{t.documentType.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                {t.description && <p className="text-xs text-gray-500 line-clamp-2 mt-1">{t.description}</p>}
                <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
                  <span>{t._count.documents} generated</span>
                  <span>v{t.version}</span>
                  {t.jurisdiction && <span className="uppercase">{t.jurisdiction}</span>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {(!templates || templates.length === 0) && (
        <Card className="p-12 text-center">
          <Layers className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No assembly templates yet</p>
          <p className="text-xs text-gray-400 mt-1">Create templates with merge fields and conditional logic</p>
        </Card>
      )}

      {/* Recent Documents */}
      {documents && documents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recently Assembled</h2>
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                  <p className="text-xs text-gray-500">{doc.template?.name} · {new Date(doc.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge className={cn("text-[10px]", doc.status === "approved" ? "bg-green-100 text-green-700" : doc.status === "draft" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700")}>{doc.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
