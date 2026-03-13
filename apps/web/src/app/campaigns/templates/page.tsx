"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, FileText, Trash2, Edit, Mail } from "lucide-react";

const categoryColors: Record<string, string> = {
  Newsletter: "bg-blue-100 text-blue-700",
  Welcome: "bg-green-100 text-green-700",
  "Follow-up": "bg-amber-100 text-amber-700",
  "Legal Update": "bg-purple-100 text-purple-700",
  Holiday: "bg-pink-100 text-pink-700",
  Other: "bg-gray-100 text-gray-700",
};

export default function TemplatesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.campaigns.listTemplates.useQuery();
  const deleteTemplate = trpc.campaigns.deleteTemplate.useMutation({
    onSuccess: () => {
      toast({ title: "Template deleted" });
      utils.campaigns.listTemplates.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/campaigns">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Email Templates</h1>
            <p className="text-gray-500">Reusable email templates for campaigns</p>
          </div>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-600">
          <Link href="/campaigns/templates/new">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Link>
        </Button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !templates || templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No templates yet</h3>
          <p className="text-gray-500 mb-4">Create reusable email templates</p>
          <Button asChild className="bg-blue-500 hover:bg-blue-600">
            <Link href="/campaigns/templates/new">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{t.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{t.subject}</p>
                </div>
                {t.category && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      categoryColors[t.category] || categoryColors.Other
                    }`}
                  >
                    {t.category}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 mb-4">
                Updated {new Date(t.updatedAt).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/campaigns/templates/new?edit=${t.id}`}>
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete this template?")) {
                      deleteTemplate.mutate({ id: t.id });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-red-400" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
