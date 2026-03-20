"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Database, Settings, FileText, Clock } from "lucide-react";
import Link from "next/link";

const TYPE_COLORS: Record<string, string> = {
  JUR_STATE: "bg-blue-100 text-blue-800",
  JUR_FEDERAL_DISTRICT: "bg-purple-100 text-purple-800",
  JUR_FEDERAL_CIRCUIT: "bg-purple-100 text-purple-800",
  JUR_COUNTY: "bg-green-100 text-green-800",
  JUR_MUNICIPAL: "bg-teal-100 text-teal-800",
  JUR_TRIBAL: "bg-amber-100 text-amber-800",
};

export default function JurisdictionsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addConfigOpen, setAddConfigOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "STATE", stateCode: "" });
  const [configForm, setConfigForm] = useState({ practiceArea: "", displayName: "" });

  const jurisdictions = trpc.jurisdictions["jurisdictions.list"].useQuery();
  const configs = trpc.jurisdictions["configs.list"].useQuery(
    { jurisdictionId: selectedId! },
    { enabled: !!selectedId }
  );
  const utils = trpc.useUtils();

  const createJurisdiction = trpc.jurisdictions["jurisdictions.create"].useMutation({
    onSuccess: () => { utils.jurisdictions["jurisdictions.list"].invalidate(); setAddOpen(false); },
  });
  const seedDefaults = trpc.jurisdictions["seed"].useMutation({
    onSuccess: () => utils.jurisdictions["jurisdictions.list"].invalidate(),
  });
  const createConfig = trpc.jurisdictions["configs.create"].useMutation({
    onSuccess: () => { utils.jurisdictions["configs.list"].invalidate(); setAddConfigOpen(false); },
  });

  const selected = jurisdictions.data?.find((j: any) => j.id === selectedId);

  return (
    <div className="flex gap-6 p-6 h-full">
      {/* Left Panel */}
      <div className="w-1/3 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Jurisdictions</h2>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Jurisdiction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Jurisdiction</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                <Input placeholder="Code (e.g. NY)" value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })} />
                <Input placeholder="Name (e.g. New York)" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STATE">State</SelectItem>
                    <SelectItem value="FEDERAL">Federal</SelectItem>
                    <SelectItem value="COUNTY">County</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="State Code" value={form.stateCode}
                  onChange={(e) => setForm({ ...form, stateCode: e.target.value })} />
                <Button onClick={() => createJurisdiction.mutate({ jurisdiction: form.code, jurisdictionName: form.name, jurisdictionType: form.type === "STATE" ? "JUR_STATE" : form.type === "FEDERAL" ? "JUR_FEDERAL_DISTRICT" : "JUR_COUNTY", state: form.stateCode || undefined })}
                  disabled={createJurisdiction.isLoading}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {jurisdictions.data?.map((j: any) => (
            <button key={j.id} onClick={() => setSelectedId(j.id)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                selectedId === j.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{j.jurisdictionName}</span>
                <Badge className={TYPE_COLORS[j.jurisdictionType] ?? ""}>{j.jurisdictionType}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span>{j.state}</span>
                <span>&middot;</span>
                <span>{j._count?.configs ?? 0} configs</span>
              </div>
            </button>
          ))}
        </div>

        <Button variant="outline" className="w-full" onClick={() => seedDefaults.mutate()}
          disabled={seedDefaults.isLoading}>
          <Database className="h-4 w-4 mr-2" />Seed Defaults
        </Button>
      </div>

      {/* Right Panel */}
      <div className="w-2/3 flex flex-col gap-4">
        {selectedId ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Configurations &mdash; {selected?.jurisdictionName}
              </h2>
              <Dialog open={addConfigOpen} onOpenChange={setAddConfigOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Configuration</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Configuration</DialogTitle></DialogHeader>
                  <div className="flex flex-col gap-3 pt-2">
                    <Input placeholder="Practice Area Key" value={configForm.practiceArea}
                      onChange={(e) => setConfigForm({ ...configForm, practiceArea: e.target.value })} />
                    <Input placeholder="Display Name" value={configForm.displayName}
                      onChange={(e) => setConfigForm({ ...configForm, displayName: e.target.value })} />
                    <Button onClick={() => createConfig.mutate({ ...configForm, jurisdictionId: selectedId })}
                      disabled={createConfig.isLoading}>Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 gap-4 overflow-y-auto">
              {configs.data?.map((c: any) => (
                <Card key={c.id} className="p-4 flex flex-col gap-2">
                  <span className="font-medium">{c.displayName}</span>
                  <div className="flex gap-2">
                    <Badge variant="outline"><FileText className="h-3 w-3 mr-1" />{c._count?.forms ?? 0} forms</Badge>
                    <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{c._count?.deadlines ?? 0} deadlines</Badge>
                  </div>
                  <Link href={`/settings/jurisdictions/${c.id}`}>
                    <Button variant="ghost" size="sm" className="mt-1">
                      <Settings className="h-4 w-4 mr-1" />Configure
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a jurisdiction from the left to see practice area configurations
          </div>
        )}
      </div>
    </div>
  );
}
