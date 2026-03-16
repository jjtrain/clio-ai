"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Users, Heart } from "lucide-react";

export default function FamilyLawPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: cases } = trpc.familyLaw.getCases.useQuery();
  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const matters = mattersData?.matters || [];

  const createMut = trpc.familyLaw.createCase.useMutation({
    onSuccess: (d) => { utils.familyLaw.getCases.invalidate(); setCreateOpen(false); router.push(`/family/${d.matterId}`); },
  });

  const existingMatterIds = new Set((cases || []).map((c: any) => c.matterId));
  const availableMatters = matters.filter((m: any) => !existingMatterIds.has(m.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Family Law</h1>
          <p className="text-sm text-slate-500">Manage custody, support, and co-parenting with OurFamilyWizard</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Family Case</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(cases || []).map((fc: any) => (
          <Card key={fc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/family/${fc.matterId}`)}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <Heart className="h-5 w-5 text-pink-500" />
                <div>
                  <p className="font-medium">{fc.matter?.name}</p>
                  <p className="text-xs text-slate-500">{fc.matter?.client?.name}</p>
                </div>
              </div>
              {fc.opposingPartyName && <p className="text-sm text-slate-600">vs. {fc.opposingPartyName}</p>}
              {fc.caseType && <p className="text-xs text-slate-400">{fc.caseType}</p>}
              {fc.ofwConnection && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3 text-blue-500" />
                  <span className={fc.ofwConnection.connectionStatus === "ACTIVE" ? "text-green-600" : "text-gray-500"}>
                    OFW {fc.ofwConnection.connectionStatus}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {!cases?.length && <p className="text-slate-500 col-span-3 text-center py-8">No family cases yet</p>}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Family Case</DialogTitle></DialogHeader>
          <NewFamilyCaseForm matters={availableMatters} onSubmit={(d: any) => createMut.mutate(d)} isLoading={createMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewFamilyCaseForm({ matters, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ matterId: "", caseType: "", opposingPartyName: "", childrenNames: "" });
  return (
    <div className="space-y-4">
      <div className="space-y-2"><Label>Matter *</Label>
        <Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name} — {m.client?.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2"><Label>Case Type</Label><Input value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })} placeholder="Divorce, Custody, Support Modification..." /></div>
      <div className="space-y-2"><Label>Opposing Party</Label><Input value={form.opposingPartyName} onChange={(e) => setForm({ ...form, opposingPartyName: e.target.value })} /></div>
      <div className="space-y-2"><Label>Children (comma-separated)</Label><Input value={form.childrenNames} onChange={(e) => setForm({ ...form, childrenNames: e.target.value })} placeholder="Emma, Jack" /></div>
      <Button className="w-full" disabled={!form.matterId || isLoading} onClick={() => onSubmit({ ...form, caseType: form.caseType || undefined, opposingPartyName: form.opposingPartyName || undefined, childrenNames: form.childrenNames || undefined })}>
        {isLoading ? "Creating..." : "Create Case"}
      </Button>
    </div>
  );
}
