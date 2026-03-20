"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Database, Plus, BookOpen } from "lucide-react";

const PRACTICE_AREAS = [
  "All", "Personal Injury", "Medical Malpractice", "Contract",
  "Employment", "Real Estate", "Family", "Criminal", "Immigration",
];

export default function SolTemplatesPage() {
  const [activeArea, setActiveArea] = useState("All");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    practiceArea: "", jurisdiction: "", causeOfAction: "",
    limitationPeriod: "", limitationDays: 0, statute: "", accrualBasis: "",
  });

  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.sol["templates.list"].useQuery(
    { practiceArea: activeArea === "All" ? undefined : activeArea }
  );
  const seedDefaults = trpc.sol["templates.seed"].useMutation({
    onSuccess: () => utils.sol["templates.list"].invalidate(),
  });
  const createTemplate = trpc.sol["templates.create"].useMutation({
    onSuccess: () => { utils.sol["templates.list"].invalidate(); setOpen(false); },
  });

  const tabCls = (a: string) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      activeArea === a ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">SOL Templates</h1>
            <p className="text-gray-500">Standard limitation periods by practice area</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
            <Database className="h-4 w-4 mr-2" />Seed Defaults
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />Add Template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New SOL Template</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Practice Area</Label><Input value={form.practiceArea} onChange={(e) => setForm({ ...form, practiceArea: e.target.value })} /></div>
                  <div><Label>Jurisdiction</Label><Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Cause of Action</Label><Input value={form.causeOfAction} onChange={(e) => setForm({ ...form, causeOfAction: e.target.value })} /></div>
                  <div><Label>Limitation Period</Label><Input value={form.limitationPeriod} onChange={(e) => setForm({ ...form, limitationPeriod: e.target.value })} placeholder="e.g. 2 years" /></div>
                  <div><Label>Limitation Days</Label><Input type="number" value={form.limitationDays || ""} onChange={(e) => setForm({ ...form, limitationDays: parseInt(e.target.value) || 0 })} /></div>
                  <div><Label>Statute</Label><Input value={form.statute} onChange={(e) => setForm({ ...form, statute: e.target.value })} /></div>
                  <div><Label>Accrual Basis</Label>
                    <Select value={form.accrualBasis} onValueChange={(v) => setForm({ ...form, accrualBasis: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INJURY_DATE">Injury Date</SelectItem>
                        <SelectItem value="DISCOVERY">Discovery Rule</SelectItem>
                        <SelectItem value="LAST_TREATMENT">Last Treatment</SelectItem>
                        <SelectItem value="BREACH_DATE">Breach Date</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={createTemplate.isPending}
                  onClick={() => createTemplate.mutate(form)}>Create Template</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Practice Area Tabs */}
      <div className="flex flex-wrap gap-1">
        {PRACTICE_AREAS.map((a) => (
          <button key={a} onClick={() => setActiveArea(a)} className={tabCls(a)}>{a}</button>
        ))}
      </div>

      {/* Templates Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : !templates?.length ? (
          <div className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No templates</h3>
            <p className="text-gray-500 mb-4">Seed defaults or create a custom template</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Cause of Action</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Jurisdiction</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Limitation Period</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Statute</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Accrual Basis</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Notice Req.</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{t.causeOfAction}</td>
                  <td className="py-3 px-4"><Badge variant="outline" className="text-[10px]">{t.jurisdiction}</Badge></td>
                  <td className="py-3 px-4 text-gray-600">{t.limitationPeriod}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{t.statute}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{t.accrualBasis ?? "—"}</td>
                  <td className="py-3 px-4">
                    {t.noticeOfClaimRequired
                      ? <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Required</Badge>
                      : <span className="text-gray-300 text-xs">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
