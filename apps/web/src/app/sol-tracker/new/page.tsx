"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Clock, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewSolPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"template" | "custom">("template");
  const [matterSearch, setMatterSearch] = useState("");
  const [matterId, setMatterId] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [accrualDate, setAccrualDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  // Custom form
  const [custom, setCustom] = useState({
    causeOfAction: "", limitationPeriod: "", limitationDays: 0,
    statute: "", accrualBasis: "", notes: "",
  });

  const { data: templates } = trpc.sol["templates.list"].useQuery(
    { practiceArea, jurisdiction },
    { enabled: tab === "template" && !!practiceArea }
  );
  const { data: matterTemplates } = trpc.sol["templates.getForMatter"].useQuery(
    { matterId },
    { enabled: tab === "template" && !!matterId }
  );
  const createFromTemplate = trpc.sol["createFromTemplate"].useMutation({
    onSuccess: (d) => router.push(`/sol-tracker/${d.id}`),
  });
  const createCustom = trpc.sol["createCustom"].useMutation({
    onSuccess: (d) => router.push(`/sol-tracker/${d.id}`),
  });

  const tplList = matterTemplates ?? templates ?? [];
  const selectedTpl = tplList.find((t) => t.id === selectedTemplate);
  const calcExpiration = accrualDate && selectedTpl
    ? new Date(new Date(accrualDate).getTime() + selectedTpl.limitationDays * 86400000)
    : null;
  const calcDays = calcExpiration
    ? Math.ceil((calcExpiration.getTime() - Date.now()) / 86400000) : null;

  const tabCls = (t: string) =>
    `pb-3 text-sm font-medium border-b-2 transition-colors ${
      tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sol-tracker"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">New Statute of Limitations</h1>
      </div>

      <div className="border-b border-gray-200 flex gap-6">
        <button onClick={() => setTab("template")} className={tabCls("template")}>
          <FileText className="h-4 w-4 inline mr-1.5" />From Template
        </button>
        <button onClick={() => setTab("custom")} className={tabCls("custom")}>
          <Plus className="h-4 w-4 inline mr-1.5" />Custom
        </button>
      </div>

      {tab === "template" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <Label>Matter</Label>
              <Input placeholder="Search matters..." value={matterSearch}
                onChange={(e) => setMatterSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Practice Area</Label>
                <Input value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} placeholder="e.g. Personal Injury" /></div>
              <div><Label>Jurisdiction</Label>
                <Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. CA" /></div>
            </div>
          </div>

          {tplList.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Available Templates</h3>
              {tplList.map((t) => (
                <div key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-colors ${
                    selectedTemplate === t.id ? "border-blue-500 ring-2 ring-blue-100" : "border-gray-100 hover:border-gray-200"
                  }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{t.causeOfAction}</p>
                      <p className="text-sm text-gray-500">{t.limitationPeriod} &middot; {t.statute}</p>
                    </div>
                    <Button size="sm" variant={selectedTemplate === t.id ? "default" : "outline"}
                      className={selectedTemplate === t.id ? "bg-blue-600" : ""}>
                      {selectedTemplate === t.id ? "Selected" : "Select"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedTemplate && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Accrual Date</Label>
                  <Input type="date" value={accrualDate} onChange={(e) => setAccrualDate(e.target.value)} /></div>
                <div><Label>Assigned To</Label>
                  <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="Attorney name" /></div>
              </div>
              {calcExpiration && (
                <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Calculated Expiration</p>
                    <p className="font-semibold">{calcExpiration.toLocaleDateString()}</p>
                  </div>
                  <Badge className={`ml-auto ${calcDays! <= 90 ? "bg-red-100 text-red-700" : calcDays! <= 180 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"} border-0`}>
                    {calcDays} days remaining
                  </Badge>
                </div>
              )}
              <Button className="bg-blue-600 hover:bg-blue-700 w-full" disabled={!accrualDate || createFromTemplate.isPending}
                onClick={() => createFromTemplate.mutate({ templateId: selectedTemplate, matterId, accrualDate, assignedTo })}>
                <CheckCircle2 className="h-4 w-4 mr-2" />Create SOL
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "custom" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Matter ID</Label><Input value={matterId} onChange={(e) => setMatterId(e.target.value)} /></div>
            <div><Label>Practice Area</Label><Input value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} /></div>
            <div><Label>Jurisdiction</Label><Input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} /></div>
            <div><Label>Cause of Action</Label><Input value={custom.causeOfAction} onChange={(e) => setCustom({ ...custom, causeOfAction: e.target.value })} /></div>
            <div><Label>Limitation Period</Label><Input value={custom.limitationPeriod} onChange={(e) => setCustom({ ...custom, limitationPeriod: e.target.value })} placeholder="e.g. 2 years" /></div>
            <div><Label>Limitation Days</Label><Input type="number" value={custom.limitationDays || ""} onChange={(e) => setCustom({ ...custom, limitationDays: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Statute</Label><Input value={custom.statute} onChange={(e) => setCustom({ ...custom, statute: e.target.value })} /></div>
            <div><Label>Accrual Date</Label><Input type="date" value={accrualDate} onChange={(e) => setAccrualDate(e.target.value)} /></div>
            <div><Label>Accrual Basis</Label>
              <Select value={custom.accrualBasis} onValueChange={(v) => setCustom({ ...custom, accrualBasis: v })}>
                <SelectTrigger><SelectValue placeholder="Select basis" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INJURY_DATE">Injury Date</SelectItem>
                  <SelectItem value="DISCOVERY">Discovery Rule</SelectItem>
                  <SelectItem value="LAST_TREATMENT">Last Treatment</SelectItem>
                  <SelectItem value="BREACH_DATE">Breach Date</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Assigned To</Label><Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={custom.notes} onChange={(e) => setCustom({ ...custom, notes: e.target.value })} rows={3} /></div>
          <Button className="bg-blue-600 hover:bg-blue-700 w-full" disabled={createCustom.isPending}
            onClick={() => createCustom.mutate({
              matterId, practiceArea, jurisdiction, accrualDate, assignedTo,
              ...custom,
            })}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Create Custom SOL
          </Button>
        </div>
      )}
    </div>
  );
}
