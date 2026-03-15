"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Sparkles } from "lucide-react";

const CATEGORIES = ["ENGAGEMENT", "PLEADING", "MOTION", "LETTER", "AGREEMENT", "DISCOVERY", "COURT_FORM", "OTHER"];

function NewTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isAiMode = searchParams.get("ai") === "1";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [practiceArea, setPracticeArea] = useState("");
  const [content, setContent] = useState("");
  const [variables, setVariables] = useState("[]");

  // AI mode
  const [aiDescription, setAiDescription] = useState("");

  const createTemplate = trpc.drafting.createTemplate.useMutation({
    onSuccess: (t) => { toast({ title: "Template created" }); router.push(`/drafting/templates/${t.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const aiCreateTemplate = trpc.drafting.aiCreateTemplate.useMutation({
    onSuccess: (t) => { toast({ title: "Template created by AI" }); router.push(`/drafting/templates/${t.id}`); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleManualCreate = () => {
    if (!name.trim() || !content.trim()) return;
    createTemplate.mutate({
      name, description: description || undefined, category: category as any,
      practiceArea: practiceArea || undefined, content, variables,
    });
  };

  const handleAiCreate = () => {
    if (!aiDescription.trim()) return;
    aiCreateTemplate.mutate({
      description: aiDescription,
      category: category as any,
      practiceArea: practiceArea || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">{isAiMode ? "AI Create Template" : "Create Template"}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Practice Area (optional)</Label>
            <Input value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} placeholder="e.g. Family Law" />
          </div>
        </div>

        {isAiMode ? (
          <>
            <div className="space-y-2">
              <Label>Describe the template you want</Label>
              <Textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                rows={5}
                placeholder='e.g. "A retainer agreement for personal injury cases with contingency fee structure, 33% standard and 40% if case goes to trial"'
              />
            </div>
            <Button
              onClick={handleAiCreate}
              disabled={!aiDescription.trim() || aiCreateTemplate.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {aiCreateTemplate.isPending ? (
                <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating template...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate Template</>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Template Name <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Retainer Agreement" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
            </div>
            <div className="space-y-2">
              <Label>Content (HTML with {"{{VARIABLE}}"} placeholders) <span className="text-red-500">*</span></Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={20} className="font-mono text-sm" placeholder="<h1>Document Title</h1><p>This agreement between {{CLIENT_NAME}} and..." />
            </div>
            <div className="space-y-2">
              <Label>Variables (JSON)</Label>
              <Textarea value={variables} onChange={(e) => setVariables(e.target.value)} rows={4} className="font-mono text-xs" placeholder='[{"name":"CLIENT_NAME","label":"Client Name","type":"text","required":true}]' />
            </div>
            <Button onClick={handleManualCreate} disabled={!name.trim() || !content.trim() || createTemplate.isPending} className="bg-rose-600 hover:bg-rose-700">
              <Save className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading...</div>}>
      <NewTemplateContent />
    </Suspense>
  );
}
