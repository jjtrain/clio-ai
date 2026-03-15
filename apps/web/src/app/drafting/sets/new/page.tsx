"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";

export default function NewDocumentSetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: matters } = trpc.matters.list.useQuery();

  const [name, setName] = useState("");
  const [matterId, setMatterId] = useState("");
  const [description, setDescription] = useState("");

  const createSet = trpc.drafting.createSet.useMutation({
    onSuccess: (s) => { toast({ title: "Document set created" }); router.push(`/drafting/sets/${s.id}`); },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/drafting"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">New Document Set</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="space-y-2">
          <Label>Set Name <span className="text-red-500">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Smith v. Jones - Initial Filing Package" />
        </div>
        <div className="space-y-2">
          <Label>Link to Matter (optional)</Label>
          <Select value={matterId} onValueChange={setMatterId}>
            <SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {matters?.matters?.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.matterNumber} - {m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
        </div>
        <Button
          onClick={() => createSet.mutate({ name, matterId: matterId && matterId !== "none" ? matterId : undefined, description: description || undefined })}
          disabled={!name.trim() || createSet.isPending}
          className="bg-rose-600 hover:bg-rose-700"
        >
          <Save className="h-4 w-4 mr-2" /> Create Set
        </Button>
      </div>
    </div>
  );
}
