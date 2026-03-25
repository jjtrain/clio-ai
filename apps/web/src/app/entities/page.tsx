"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { Building2, Filter, Calendar, ChevronRight, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = { ACTIVE: "bg-green-100 text-green-700", SUSPENDED: "bg-red-100 text-red-700", DISSOLVED: "bg-gray-100 text-gray-500" };
function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }
function daysUntil(d: any) { if (!d) return null; return Math.round((new Date(d).getTime() - Date.now()) / 86400000); }

export default function EntitiesDashboard() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const entitiesQuery = trpc.corporateEntities.getFirmEntities.useQuery(
    { status: filterStatus !== "all" ? filterStatus : undefined, entityType: filterType !== "all" ? filterType : undefined }
  );
  const entities = entitiesQuery.data || [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-7 w-7 text-indigo-600" /> Corporate Entities</h1>
          <p className="text-sm text-muted-foreground mt-1">All entities across the firm</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="SUSPENDED">Suspended</SelectItem><SelectItem value="DISSOLVED">Dissolved</SelectItem></SelectContent></Select>
        <Select value={filterType} onValueChange={setFilterType}><SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{["LLC", "C_CORP", "S_CORP", "LP", "LLP", "NONPROFIT"].map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
        <span className="text-xs text-muted-foreground ml-auto">{entities.length} entities</span>
      </div>

      <div className="space-y-2">
        {entities.map((e: any) => {
          const nd = daysUntil(e.nextFilingDeadline);
          return (
            <Link key={e.id} href={`/entities/${e.id}`}>
              <Card className="p-4 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2"><span className="text-sm font-semibold">{e.entityName}</span><Badge variant="outline" className="text-[10px]">{e.entityType.replace(/_/g, " ")}</Badge><Badge className={cn("text-[10px]", STATUS_COLORS[e.status] || "")}>{e.status}</Badge></div>
                    <p className="text-xs text-muted-foreground mt-0.5">{e.stateOfFormation} · {e.officers?.length || 0} officers · {e._count?.filings || 0} filings · {e._count?.documents || 0} docs</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.nextFilingDeadline && <span className={cn("text-xs", nd !== null && nd < 0 ? "text-red-600 font-semibold" : nd !== null && nd <= 30 ? "text-amber-600" : "text-muted-foreground")}><Calendar className="h-3 w-3 inline mr-0.5" />{fmtDate(e.nextFilingDeadline)}</span>}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
        {entities.length === 0 && <Card className="p-12 text-center"><Building2 className="h-12 w-12 text-gray-200 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No entities found</p></Card>}
      </div>
    </div>
  );
}
