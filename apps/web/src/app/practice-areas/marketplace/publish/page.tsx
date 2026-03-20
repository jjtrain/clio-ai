"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, ArrowLeft, ArrowRight } from "lucide-react";

export default function PublishPage() {
  const [step, setStep] = useState(1);
  const [practiceAreaId, setPracticeAreaId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const { data: enabledAreas } = trpc.practiceArea["config.getEnabledList"].useQuery();
  const publishMutation = trpc.practiceArea["community.publish"].useMutation({
    onSuccess: (data: any) => setPublishedId(data.id),
  });

  const selectedArea = enabledAreas?.find((a: any) => a.id === practiceAreaId);
  const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

  const handlePublish = () => {
    publishMutation.mutate({ practiceAreaConfigId: practiceAreaId, title, description, jurisdiction, tags });
  };

  if (publishedId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold">Pipeline Published!</h2>
          <p className="mt-2 text-gray-500">Your pipeline template is now available in the marketplace.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/practice-areas/marketplace/${publishedId}`}>
              <Button>View Template</Button>
            </Link>
            <Link href="/practice-areas/marketplace">
              <Button variant="outline">Back to Marketplace</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Link href="/practice-areas/marketplace"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Marketplace</Button></Link>
      </div>
      <h1 className="text-2xl font-bold">Publish Pipeline Template</h1>

      <div className="mb-6 flex gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-blue-500" : "bg-gray-200"}`} />
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Select Practice Area</h2>
            <p className="text-sm text-gray-500">Choose which practice area pipeline to publish.</p>
            <Select value={practiceAreaId} onValueChange={setPracticeAreaId}>
              <SelectTrigger><SelectValue placeholder="Select a practice area" /></SelectTrigger>
              <SelectContent>
                {enabledAreas?.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!practiceAreaId}>Next <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Template Details</h2>
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Family Law Divorce Pipeline" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea className="w-full rounded-md border border-gray-200 p-3 text-sm" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your pipeline template..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Jurisdiction</label>
              <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. California, US Federal" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. divorce, custody, property" />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
              <Button onClick={() => setStep(3)} disabled={!title}>Next <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review & Publish</h2>
            <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
              <p><span className="font-medium">Practice Area:</span> {selectedArea?.displayName}</p>
              <p><span className="font-medium">Title:</span> {title}</p>
              <p><span className="font-medium">Description:</span> {description}</p>
              <p><span className="font-medium">Jurisdiction:</span> {jurisdiction || "None"}</p>
              <div className="flex flex-wrap gap-1">
                <span className="font-medium">Tags:</span>
                {tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                {tags.length === 0 && <span className="text-gray-400">None</span>}
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
              <Button onClick={handlePublish} disabled={publishMutation.isPending}>
                {publishMutation.isPending ? "Publishing..." : "Publish Template"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
