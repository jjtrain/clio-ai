"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Edit, Loader2, ShieldCheck } from "lucide-react";

const CHECK_TYPES = ["KYC", "AML", "SANCTIONS", "PEP", "ADVERSE_MEDIA", "DOCUMENT_VERIFICATION", "SOURCE_OF_FUNDS", "SOURCE_OF_WEALTH", "FULL_CDD"];
const DOC_TYPES = ["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID", "UTILITY_BILL", "BANK_STATEMENT", "COMPANY_REGISTRATION", "ARTICLES_OF_INCORPORATION", "TRUST_DEED", "PROOF_OF_ADDRESS", "SOURCE_OF_FUNDS_EVIDENCE", "SOURCE_OF_WEALTH_EVIDENCE"];

export default function PoliciesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", subjectType: "INDIVIDUAL", requiredChecks: ["KYC", "SANCTIONS", "PEP"], requiredDocs: ["PASSPORT", "PROOF_OF_ADDRESS"], practiceArea: "", isDefault: false });

  const { data: policies, isLoading } = trpc.compliance["policies.list"].useQuery();
  const initMut = trpc.compliance["policies.initialize"].useMutation({ onSuccess: () => { utils.compliance["policies.list"].invalidate(); toast({ title: "Default policies created" }); } });
  const createMut = trpc.compliance["policies.create"].useMutation({ onSuccess: () => { utils.compliance["policies.list"].invalidate(); setShowCreate(false); toast({ title: "Policy created" }); } });
  const updateMut = trpc.compliance["policies.update"].useMutation({ onSuccess: () => { utils.compliance["policies.list"].invalidate(); setEditing(null); toast({ title: "Policy updated" }); } });

  const toggleCheck = (ct: string) => setForm({ ...form, requiredChecks: form.requiredChecks.includes(ct) ? form.requiredChecks.filter(t => t !== ct) : [...form.requiredChecks, ct] });
  const toggleDoc = (dt: string) => setForm({ ...form, requiredDocs: form.requiredDocs.includes(dt) ? form.requiredDocs.filter(t => t !== dt) : [...form.requiredDocs, dt] });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Compliance Policies</h1><p className="text-sm text-slate-500">Define check requirements by client type</p></div>
        <div className="flex gap-2">
          {(!policies || policies.length === 0) && <Button variant="outline" onClick={() => initMut.mutate()} disabled={initMut.isLoading}>{initMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Initialize Defaults</Button>}
          <Button onClick={() => { setForm({ name: "", description: "", subjectType: "INDIVIDUAL", requiredChecks: ["KYC", "SANCTIONS", "PEP"], requiredDocs: ["PASSPORT", "PROOF_OF_ADDRESS"], practiceArea: "", isDefault: false }); setShowCreate(true); }}><Plus className="h-4 w-4 mr-2" /> New Policy</Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(policies || []).map((p: any) => {
            const checks = p.requiredChecks ? JSON.parse(p.requiredChecks) : [];
            const docs = p.requiredDocuments ? JSON.parse(p.requiredDocuments) : [];
            return (
              <Card key={p.id} className={!p.isActive ? "opacity-50" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      {p.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>}
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{p.subjectType}</span>
                  </div>
                  {p.description && <p className="text-xs text-gray-500 mb-3">{p.description}</p>}
                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-gray-500">Checks: <span className="text-gray-700">{checks.join(", ")}</span></p>
                    <p className="text-xs text-gray-500">Documents: <span className="text-gray-700">{docs.join(", ").replace(/_/g, " ")}</span></p>
                    {p.practiceArea && <p className="text-xs text-gray-500">Practice Area: <span className="text-gray-700">{p.practiceArea}</span></p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p); setForm({ name: p.name, description: p.description || "", subjectType: p.subjectType, requiredChecks: checks, requiredDocs: docs, practiceArea: p.practiceArea || "", isDefault: p.isDefault }); }}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate || !!editing} onOpenChange={() => { setShowCreate(false); setEditing(null); }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Policy" : "Create Policy"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Subject Type</Label><Select value={form.subjectType} onValueChange={(v) => setForm({ ...form, subjectType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["INDIVIDUAL", "COMPANY", "TRUST", "PARTNERSHIP"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Required Checks</Label><div className="grid grid-cols-2 gap-1 mt-1">{CHECK_TYPES.map(ct => (<label key={ct} className="flex items-center gap-2 text-sm p-1"><input type="checkbox" checked={form.requiredChecks.includes(ct)} onChange={() => toggleCheck(ct)} />{ct.replace(/_/g, " ")}</label>))}</div></div>
            <div><Label>Required Documents</Label><div className="grid grid-cols-2 gap-1 mt-1">{DOC_TYPES.map(dt => (<label key={dt} className="flex items-center gap-2 text-sm p-1"><input type="checkbox" checked={form.requiredDocs.includes(dt)} onChange={() => toggleDoc(dt)} />{dt.replace(/_/g, " ")}</label>))}</div></div>
            <div><Label>Practice Area (optional)</Label><Input value={form.practiceArea} onChange={(e) => setForm({ ...form, practiceArea: e.target.value })} /></div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /><span className="text-sm">Default policy</span></label>
            <Button className="w-full" disabled={!form.name} onClick={() => {
              const data = { name: form.name, description: form.description || undefined, subjectType: form.subjectType as any, requiredChecks: JSON.stringify(form.requiredChecks), requiredDocuments: JSON.stringify(form.requiredDocs), practiceArea: form.practiceArea || undefined, isDefault: form.isDefault };
              if (editing) updateMut.mutate({ id: editing.id, ...data }); else createMut.mutate(data);
            }}>{editing ? "Update" : "Create"} Policy</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
