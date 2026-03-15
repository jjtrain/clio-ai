"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  Star,
  Copy,
  Pencil,
  Trash2,
  FileText,
  Palette,
  Eye,
} from "lucide-react";

const FORMAT_LABELS: Record<string, string> = {
  SUMMARY: "Summary",
  DETAILED: "Detailed",
  TIMEKEEPER: "Timekeeper",
  FLAT_FEE: "Flat Fee",
  CUSTOM: "Custom",
};

const FORMAT_COLORS: Record<string, string> = {
  SUMMARY: "bg-blue-100 text-blue-700",
  DETAILED: "bg-purple-100 text-purple-700",
  TIMEKEEPER: "bg-amber-100 text-amber-700",
  FLAT_FEE: "bg-emerald-100 text-emerald-700",
  CUSTOM: "bg-gray-100 text-gray-700",
};

export default function TemplateManagerPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: templates, isLoading } = trpc.invoiceTemplates.list.useQuery();

  const duplicateMutation = trpc.invoiceTemplates.duplicate.useMutation({
    onSuccess: () => {
      toast({ title: "Template duplicated" });
      utils.invoiceTemplates.list.invalidate();
    },
  });

  const deleteMutation = trpc.invoiceTemplates.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Template deleted" });
      utils.invoiceTemplates.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Cannot delete template", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultMutation = trpc.invoiceTemplates.setDefault.useMutation({
    onSuccess: () => {
      toast({ title: "Default template updated" });
      utils.invoiceTemplates.list.invalidate();
    },
  });

  const filtered = templates?.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const parseBranding = (branding: string) => {
    try { return JSON.parse(branding); } catch { return {}; }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Invoice Templates</h1>
            <p className="text-gray-500 mt-1 text-sm">Customize how your invoices look</p>
          </div>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-600 shadow-sm">
          <Link href="/billing-templates/new">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Link>
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white border-gray-200"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Palette className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No templates found</p>
          <Button asChild className="mt-4" variant="outline" size="sm">
            <Link href="/billing-templates/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered?.map((template) => {
            const branding = parseBranding(template.branding as string);
            return (
              <div
                key={template.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Color preview bar */}
                <div
                  className="h-2"
                  style={{ backgroundColor: branding.primaryColor || "#1E40AF" }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                        {template.isDefault && (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {template.description || "No description"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/billing-templates/${template.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/billing-templates/${template.id}?preview=true`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateMutation.mutate({ id: template.id })}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {!template.isDefault && (
                          <DropdownMenuItem
                            onClick={() => setDefaultMutation.mutate({ id: template.id })}
                          >
                            <Star className="mr-2 h-4 w-4" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        {!template.isDefault && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              if (confirm("Delete this template?")) {
                                deleteMutation.mutate({ id: template.id });
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FORMAT_COLORS[template.format] || FORMAT_COLORS.CUSTOM}`}>
                      {FORMAT_LABELS[template.format] || template.format}
                    </span>
                    <span className="text-xs text-gray-400">
                      {branding.fontFamily || "Inter"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-4 pt-3 border-t">
                    <div className="flex gap-1.5">
                      <div
                        className="h-5 w-5 rounded-full border border-gray-200"
                        style={{ backgroundColor: branding.primaryColor || "#1E40AF" }}
                        title="Primary"
                      />
                      <div
                        className="h-5 w-5 rounded-full border border-gray-200"
                        style={{ backgroundColor: branding.accentColor || "#3B82F6" }}
                        title="Accent"
                      />
                    </div>
                    <div className="flex-1" />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/billing-templates/${template.id}`}>
                        <Pencil className="mr-1.5 h-3 w-3" />
                        Edit
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
