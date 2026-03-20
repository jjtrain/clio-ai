"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Eye, Share2, Copy, FileText } from "lucide-react";

const practiceAreas = [
  "Personal Injury", "Family Law", "Criminal Defense", "Immigration",
  "Estate Planning", "Business Law", "Employment Law", "Real Estate",
];

export default function FormsListPage() {
  const { data: forms, refetch } = trpc.intakeForms["forms.list"].useQuery();
  const createForm = trpc.intakeForms["forms.create"].useMutation({ onSuccess: () => { refetch(); setOpen(false); } });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [practiceArea, setPracticeArea] = useState("");

  const handleCreate = () => {
    if (!name || !practiceArea) return;
    createForm.mutate({ name, practiceArea });
    setName("");
    setPracticeArea("");
  };

  const handleDuplicate = (form: any) => {
    createForm.mutate({ name: `${form.name} (Copy)`, practiceArea: form.practiceArea });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Intake Forms</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" />Create New Form</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New Form</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Form Name</Label>
                <Input placeholder="e.g. Personal Injury Intake" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Practice Area</Label>
                <Select value={practiceArea} onValueChange={setPracticeArea}>
                  <SelectTrigger><SelectValue placeholder="Select practice area" /></SelectTrigger>
                  <SelectContent>
                    {practiceAreas.map((pa) => (
                      <SelectItem key={pa} value={pa}>{pa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createForm.isPending}>
                {createForm.isPending ? "Creating..." : "Create Form"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!forms?.length ? (
        <div className="text-center py-16 text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No forms yet. Create your first intake form to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form: any) => (
            <Card key={form.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-sm">{form.name}</h3>
                  <Badge variant={form.published ? "default" : "secondary"}>
                    {form.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{form.practiceArea}</Badge>
                  <span className="text-xs text-gray-500">{form.submissionCount ?? 0} submissions</span>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <Button asChild variant="ghost" size="sm"><Link href={`/intake-admin/forms/${form.id}`}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Link></Button>
                  <Button asChild variant="ghost" size="sm"><Link href={`/intake/${form.id}`} target="_blank"><Eye className="w-3.5 h-3.5 mr-1" />Preview</Link></Button>
                  <Button asChild variant="ghost" size="sm"><Link href={`/intake-admin/forms/${form.id}?tab=sharing`}><Share2 className="w-3.5 h-3.5 mr-1" />Share</Link></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicate(form)}><Copy className="w-3.5 h-3.5 mr-1" />Duplicate</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
