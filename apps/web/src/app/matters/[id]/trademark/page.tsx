"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Shield, RefreshCw, Clock, AlertTriangle, FileText, ExternalLink,
  CheckCircle, Loader2, Plus, Calendar, User, Hash, Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function fmtDate(d: any) { if (!d) return "—"; try { return new Date(d).toLocaleDateString(); } catch { return "—"; } }
function daysSince(d: any) { if (!d) return null; return Math.round((Date.now() - new Date(d).getTime()) / 86400000); }

export default function TrademarkMonitorPage() {
  const { id: matterId } = useParams<{ id: string }>();
  const [serialInput, setSerialInput] = useState("");
  const [markInput, setMarkInput] = useState("");

  const tmQuery = trpc.docketing.getTrademarkForMatter.useQuery({ matterId });
  const addMut = trpc.docketing.addTrademarkToMonitor.useMutation({ onSuccess: () => tmQuery.refetch() });
  const refreshMut = trpc.docketing.refreshTrademarkFull.useMutation({ onSuccess: () => tmQuery.refetch() });
  const viewMut = trpc.docketing.markTrademarkViewed.useMutation();
  const removeMut = trpc.docketing.removeTrademarkMonitor.useMutation({ onSuccess: () => tmQuery.refetch() });

  const tm = tmQuery.data;

  // Mark as viewed on mount
  useEffect(() => {
    if (tm?.id && tm.newEventsSinceView > 0) viewMut.mutate({ trademarkDocketId: tm.id });
  }, [tm?.id]);

  // Auto-fetch on mount if stale (>24h)
  useEffect(() => {
    if (tm?.id) {
      const hoursSince = (Date.now() - new Date(tm.lastChecked).getTime()) / 3600000;
      if (hoursSince > 24) refreshMut.mutate({ trademarkDocketId: tm.id });
    }
  }, [tm?.id]);

  const history = (tm?.prosecutionHistory as any[] || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const documents = (tm?.documentsList as any[] || []);
  const receiptDate = tm?.filingDate ? new Date(tm.filingDate) : null;

  if (!tm) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-indigo-600" /> Trademark Monitor</h2>
          <p className="text-sm text-muted-foreground mt-1">Track a trademark application via USPTO TSDR</p>
        </div>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-4">Enter a USPTO serial number to start monitoring.</p>
          <div className="flex gap-2">
            <Input value={serialInput} onChange={(e) => setSerialInput(e.target.value)} placeholder="Serial number (e.g. 97123456)" className="w-[200px]" />
            <Input value={markInput} onChange={(e) => setMarkInput(e.target.value)} placeholder="Mark name" className="flex-1" />
            <Button onClick={() => addMut.mutate({ matterId, serialNumber: serialInput, markName: markInput })} disabled={!serialInput || !markInput || addMut.isLoading}>
              {addMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Add
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Status color
  const statusColor = tm.currentStatus?.toUpperCase().includes("REGISTERED") ? "bg-green-100 text-green-800"
    : tm.currentStatus?.toUpperCase().includes("DEAD") || tm.currentStatus?.toUpperCase().includes("CANCEL") ? "bg-red-100 text-red-800"
    : tm.currentStatus?.toUpperCase().includes("PUBLISH") ? "bg-blue-100 text-blue-800"
    : "bg-amber-100 text-amber-800";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-indigo-600" /> {tm.markName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-mono">SN {tm.serialNumber}</Badge>
            {tm.registrationNumber && <Badge variant="outline" className="font-mono">Reg {tm.registrationNumber}</Badge>}
            <Badge className={cn("text-xs", statusColor)}>{tm.currentStatus || "Unknown"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refreshMut.mutate({ trademarkDocketId: tm.id })} disabled={refreshMut.isLoading}>
            {refreshMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Refresh
          </Button>
          <span className="text-xs text-muted-foreground self-center">Last synced: {fmtDate(tm.lastChecked)}</span>
        </div>
      </div>

      {refreshMut.isSuccess && (refreshMut.data as any)?.newEvents > 0 && (
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-700"><CheckCircle className="h-4 w-4 inline mr-1" /> {(refreshMut.data as any).newEvents} new event(s) found since last sync</p>
        </Card>
      )}

      {/* Owner + Attorney */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Owner</p><p className="font-medium mt-0.5">{tm.ownerName || "—"}</p>{tm.ownerAddress && <p className="text-xs text-muted-foreground">{tm.ownerAddress}</p>}</div>
          <div><p className="text-xs text-muted-foreground">Attorney of Record</p><p className="font-medium mt-0.5">{tm.attorneyOfRecord || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Int'l Classes</p><p className="font-medium mt-0.5">{tm.internationalClasses || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Status Date</p><p className="font-medium mt-0.5">{fmtDate(tm.statusDate)}</p></div>
        </div>
      </Card>

      {/* Key Dates */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Filed", date: tm.filingDate, icon: Calendar },
          { label: "Published", date: tm.publicationDate, icon: FileText },
          { label: "Registered", date: tm.registrationDate, icon: CheckCircle },
          { label: "Next Maintenance", date: tm.nextDeadlineDate, icon: AlertTriangle },
          { label: "Days Pending", date: null, icon: Clock },
        ].map((d, i) => (
          <Card key={i} className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><d.icon className="h-3 w-3" /> {d.label}</p>
            <p className="text-sm font-semibold mt-1">
              {d.label === "Days Pending" ? (receiptDate ? `${daysSince(receiptDate)} days` : "—")
                : d.label === "Next Maintenance" && d.date ? <>{fmtDate(d.date)} <Badge variant="outline" className="text-[9px] ml-1">{tm.nextDeadlineType}</Badge></>
                : fmtDate(d.date)}
            </p>
          </Card>
        ))}
      </div>

      {/* Prosecution History */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Prosecution History ({history.length})</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No prosecution history available</p> : (
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {history.map((ev: any, i: number) => {
                const isNew = tm.lastViewedAt && new Date(ev.date) > new Date(tm.lastViewedAt);
                const isOA = (ev.description || "").toUpperCase().includes("OFFICE ACTION");
                const isPub = (ev.description || "").toUpperCase().includes("PUBLISHED");
                const dayCount = receiptDate ? daysSince(receiptDate) : null;
                return (
                  <div key={i} className={cn("flex items-start gap-3 py-2 px-2 rounded text-sm border-l-2",
                    isNew ? "bg-blue-50 border-l-blue-500" : isOA ? "border-l-red-400" : isPub ? "border-l-green-400" : "border-l-transparent")}>
                    <span className="text-xs text-muted-foreground w-[80px] flex-shrink-0 font-mono">{fmtDate(ev.date)}</span>
                    <span className="flex-1">{ev.description || ev.action}</span>
                    {isNew && <Badge className="text-[9px] bg-blue-100 text-blue-700">New</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Documents ({documents.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {documents.map((doc: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <span className="text-sm">{doc.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">{fmtDate(doc.date)}</span>
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="text-xs"><ExternalLink className="h-3 w-3 mr-1" /> View</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Remove */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-red-500 text-xs" onClick={() => { if (confirm("Remove trademark monitoring?")) removeMut.mutate({ trademarkDocketId: tm.id }); }}>
          Remove Monitor
        </Button>
      </div>
    </div>
  );
}
