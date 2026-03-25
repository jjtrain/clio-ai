"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Building2, Plus, AlertTriangle, Clock, Calendar, Loader2, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const ENTITY_TYPES = ["LLC", "C_CORP", "S_CORP", "NONPROFIT", "PROFESSIONAL_CORP", "LP", "LLP", "SERIES_LLC", "OTHER"];
const STATUS_COLORS: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", SUSPENDED: "bg-red-100 text-red-700", DISSOLVED: "bg-gray-100 text-gray-500", REVOKED: "bg-red-100 text-red-700", INACTIVE: "bg-gray-100 text-gray-500" };
function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }
function daysUntil(d: any) { if (!d) return null; return Math.round((new Date(d).getTime() - Date.now()) / 86400000); }

export default function MatterEntitiesPage() {
  const { id: matterId } = useParams<{ id: string }>();
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState<Record<string, any>>({});

  const entitiesQuery = trpc.corporateEntities.getEntitiesForMatter.useQuery({ matterId });
  const createMut = trpc.corporateEntities.createEntity.useMutation({ onSuccess: () => { entitiesQuery.refetch(); setShowAdd(false); setF({}); } });
  const checkMut = trpc.corporateEntities.checkDeadlines.useMutation({ onSuccess: () => entitiesQuery.refetch() });

  const data = entitiesQuery.data;
  const entities = data?.entities || [];
  const ds = data?.deadlineSummary;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-indigo-600" /> Corporate Entities</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => checkMut.mutate()} disabled={checkMut.isLoading}>{checkMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />} Check Deadlines</Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-3 w-3 mr-1" /> Add Entity</Button>
        </div>
      </div>

      {ds && (
        <div className="grid grid-cols-3 gap-3">
          <Card className={cn("p-3", ds.overdue > 0 ? "border-red-200 bg-red-50" : "")}><p className="text-[10px] text-red-600 uppercase">Overdue</p><p className="text-xl font-bold text-red-700">{ds.overdue}</p></Card>
          <Card className={cn("p-3", ds.dueSoon > 0 ? "border-amber-200 bg-amber-50" : "")}><p className="text-[10px] text-amber-600 uppercase">Due ≤30 Days</p><p className="text-xl font-bold text-amber-700">{ds.dueSoon}</p></Card>
          <Card className="p-3"><p className="text-[10px] text-muted-foreground uppercase">Upcoming 180d</p><p className="text-xl font-bold">{ds.upcoming}</p></Card>
        </div>
      )}

      {showAdd && (
        <Card className="p-4 border-indigo-200 bg-indigo-50/30 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input placeholder="Entity name *" onChange={(e) => setF((p) => ({ ...p, entityName: e.target.value }))} className="h-8 text-sm" />
            <Select onValueChange={(v) => setF((p) => ({ ...p, entityType: v }))}><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="State of formation *" onChange={(e) => setF((p) => ({ ...p, stateOfFormation: e.target.value }))} className="h-8 text-sm" />
            <Input placeholder="EIN (last 4)" maxLength={4} onChange={(e) => setF((p) => ({ ...p, ein: e.target.value }))} className="h-8 text-sm" />
          </div>
          <Button size="sm" onClick={() => createMut.mutate({ matterId, entityName: f.entityName || "", entityType: f.entityType || "LLC", stateOfFormation: f.stateOfFormation || "", ein: f.ein })} disabled={!f.entityName || !f.stateOfFormation}>Create</Button>
        </Card>
      )}

      <div className="space-y-2">
        {entities.map((e: any) => {
          const nd = daysUntil(e.nextFilingDeadline);
          return (
            <Link key={e.id} href={`/entities/${e.id}`}>
              <Card className="p-4 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{e.entityName}</span>
                      <Badge variant="outline" className="text-[10px]">{e.entityType.replace(/_/g, " ")}</Badge>
                      <Badge className={cn("text-[10px]", STATUS_COLORS[e.status] || "bg-gray-100")}>{e.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.stateOfFormation} · {e.officers?.length || 0} officers · {e._count?.documents || 0} docs</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.nextFilingDeadline && (
                      <div className={cn("text-right text-xs", nd !== null && nd < 0 ? "text-red-600" : nd !== null && nd <= 30 ? "text-amber-600" : "text-muted-foreground")}>
                        <Calendar className="h-3 w-3 inline mr-0.5" />{fmtDate(e.nextFilingDeadline)}
                        {e.nextFilingType && <span className="ml-1">({e.nextFilingType.replace(/_/g, " ")})</span>}
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
        {entities.length === 0 && <Card className="p-8 text-center"><p className="text-sm text-muted-foreground">No entities linked to this matter</p></Card>}
      </div>
    </div>
  );
}
