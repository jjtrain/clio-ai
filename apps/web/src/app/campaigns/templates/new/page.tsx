"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save } from "lucide-react";

const CATEGORIES = ["Newsletter", "Welcome", "Follow-up", "Legal Update", "Holiday", "Other"];

function TemplateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");

  const { data: existing } = trpc.campaigns.getTemplate.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setCategory(existing.category || "");
      setSubject(existing.subject);
      setHtmlContent(existing.htmlContent);
    }
  }, [existing]);

  const createTemplate = trpc.campaigns.createTemplate.useMutation();
  const updateTemplate = trpc.campaigns.updateTemplate.useMutation();

  const handleSave = async () => {
    if (!name || !subject || !htmlContent) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    try {
      if (editId) {
        await updateTemplate.mutateAsync({
          id: editId,
          name,
          subject,
          htmlContent,
          category: category || undefined,
        });
        toast({ title: "Template updated" });
      } else {
        await createTemplate.mutateAsync({
          name,
          subject,
          htmlContent,
          category: category || undefined,
        });
        toast({ title: "Template created" });
      }
      router.push("/campaigns/templates");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/campaigns/templates">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            {editId ? "Edit Template" : "New Template"}
          </h1>
          <p className="text-gray-500">Create a reusable email template</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Template Details</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly Newsletter"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subject <span className="text-red-500">*</span></Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. {FIRM_NAME} Monthly Update"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-mono">{"{NAME}"}</span>
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-mono">{"{EMAIL}"}</span>
            <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-mono">{"{FIRM_NAME}"}</span>
          </div>

          <div className="space-y-2">
            <Label>HTML Content <span className="text-red-500">*</span></Label>
            <Textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<p>Hello {NAME},</p>"
              rows={20}
              className="font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={createTemplate.isPending || updateTemplate.isPending}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Save className="h-4 w-4 mr-2" />
            {editId ? "Update Template" : "Save Template"}
          </Button>
        </div>

        {/* Live Preview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Live Preview</h2>
          <div className="border rounded-lg bg-gray-50 p-1">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-400 mb-1">Subject:</div>
              <div className="text-sm font-medium text-gray-900 mb-4">{subject || "..."}</div>
              <hr className="mb-4" />
              <div
                className="prose max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: htmlContent || "<p style='color: #999;'>Preview will appear here...</p>" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <TemplateForm />
    </Suspense>
  );
}
