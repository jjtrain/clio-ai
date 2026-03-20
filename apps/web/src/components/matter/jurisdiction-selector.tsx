"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Clock, CheckCircle } from "lucide-react";

interface JurisdictionSelectorProps {
  onApply: (practiceArea: string, jurisdictionId: string) => void;
}

export default function JurisdictionSelector({ onApply }: JurisdictionSelectorProps) {
  const [practiceArea, setPracticeArea] = useState("");
  const [jurisdictionId, setJurisdictionId] = useState("");

  const available = trpc.jurisdictions["configs.getAvailable"].useQuery();
  const combos = (available.data ?? []) as any[];

  const practiceAreas = Array.from(new Set(combos.map((c: any) => c.practiceArea))) as string[];
  const jurisdictions = combos.filter((c) => c.practiceArea === practiceArea);
  const selected = combos.find((c) => c.practiceArea === practiceArea && c.jurisdictionId === jurisdictionId);

  return (
    <Card className="p-4 flex flex-col gap-3">
      <span className="text-sm font-medium text-gray-700">Jurisdiction Overlay</span>
      <Select value={practiceArea} onValueChange={(v) => { setPracticeArea(v); setJurisdictionId(""); }}>
        <SelectTrigger><SelectValue placeholder="Select practice area" /></SelectTrigger>
        <SelectContent>
          {practiceAreas.map((pa) => (
            <SelectItem key={pa} value={pa}>{pa}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={jurisdictionId} onValueChange={setJurisdictionId} disabled={!practiceArea}>
        <SelectTrigger><SelectValue placeholder="Select jurisdiction" /></SelectTrigger>
        <SelectContent>
          {jurisdictions.map((j: any) => (
            <SelectItem key={j.jurisdictionId} value={j.jurisdictionId}>{j.jurisdictionName}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-md p-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="font-medium">{selected.practiceArea} &mdash; {selected.jurisdictionName}</span>
          <Badge variant="outline"><FileText className="h-3 w-3 mr-1" />{selected.formCount ?? 0}</Badge>
          <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{selected.deadlineCount ?? 0}</Badge>
        </div>
      )}
      <Button size="sm" disabled={!practiceArea || !jurisdictionId}
        onClick={() => onApply(practiceArea, jurisdictionId)}>
        Apply Jurisdiction
      </Button>
    </Card>
  );
}
