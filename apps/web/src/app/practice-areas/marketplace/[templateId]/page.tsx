"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Star, Download, ArrowRight, User, ChevronRight } from "lucide-react";

export default function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const [installOpen, setInstallOpen] = useState(false);
  const [targetPracticeArea, setTargetPracticeArea] = useState("");
  const [mergeStrategy, setMergeStrategy] = useState<"replace" | "merge" | "append">("merge");

  const { data: template } = trpc.practiceArea["community.getTemplate"].useQuery({ templateId });
  const { data: enabledAreas } = trpc.practiceArea["config.getEnabledList"].useQuery();
  const installMutation = trpc.practiceArea["community.install"].useMutation({
    onSuccess: () => setInstallOpen(false),
  });

  if (!template) return <div className="p-6 text-center text-gray-400">Loading...</div>;

  const stages = typeof template.stages === "string" ? JSON.parse(template.stages) : template.stages ?? [];

  const handleInstall = () => {
    installMutation.mutate({
      templateId,
      targetPracticeArea,
      mergeStrategy,
    });
  };

  return (
    <div className="space-y-8 p-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{template.title}</h1>
            <p className="mt-1 text-sm text-gray-500">by {template.publishedBy}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{template.practiceArea}</Badge>
              {template.jurisdiction && <Badge variant="outline">{template.jurisdiction}</Badge>}
              {(template.tags ? JSON.parse(template.tags) : []).map((tag: string) => (
                <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {Number(template.averageRating ?? 0)?.toFixed(1)} ({template.ratingCount} reviews)
            </span>
            <span className="flex items-center gap-1"><Download className="h-4 w-4" />{template.downloadCount} installs</span>
          </div>
        </div>
        <p className="mt-4 text-gray-600">{template.description}</p>
        <div className="mt-6">
          <Dialog open={installOpen} onOpenChange={setInstallOpen}>
            <DialogTrigger asChild>
              <Button size="lg">Install Pipeline</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Install &quot;{template.title}&quot;</DialogTitle>
                <DialogDescription>Choose a target practice area and merge strategy.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Target Practice Area</label>
                  <Select value={targetPracticeArea} onValueChange={setTargetPracticeArea}>
                    <SelectTrigger><SelectValue placeholder="Select practice area" /></SelectTrigger>
                    <SelectContent>
                      {enabledAreas?.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Merge Strategy</label>
                  <div className="space-y-2">
                    {(["replace", "merge", "append"] as const).map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-gray-50">
                        <input type="radio" name="strategy" checked={mergeStrategy === s} onChange={() => setMergeStrategy(s)} />
                        <div>
                          <p className="text-sm font-medium capitalize">{s}</p>
                          <p className="text-xs text-gray-500">
                            {s === "replace" && "Replace existing pipeline stages entirely"}
                            {s === "merge" && "Merge with existing stages, keeping both"}
                            {s === "append" && "Add new stages after existing ones"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInstallOpen(false)}>Cancel</Button>
                <Button onClick={handleInstall} disabled={!targetPracticeArea || installMutation.isPending}>
                  {installMutation.isPending ? "Installing..." : "Confirm Install"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Pipeline Preview</h2>
        <div className="flex flex-wrap items-center gap-2">
          {stages.map((stage: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Badge variant="secondary" className="whitespace-nowrap px-3 py-1.5">{stage.name ?? stage}</Badge>
              {i < stages.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {template.customFields && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Custom Fields</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(JSON.parse(template.customFields) as any[]).map((f: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>{f.type}</TableCell>
                  <TableCell>{f.required ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Reviews</h2>
        {template.reviews?.length > 0 ? (
          <div className="space-y-4">
            {template.reviews.map((r: any, i: number) => (
              <div key={i} className="border-b border-gray-50 pb-4 last:border-0">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">{r.reviewer}</span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className={`h-3.5 w-3.5 ${s < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-600">{r.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}
