"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Sparkles, RefreshCw, Clock, FileText, Mail, Globe } from "lucide-react";

const CONFIDENCE_COLORS: Record<string, string> = { HIGH: "bg-green-100 text-green-700", MEDIUM: "bg-amber-100 text-amber-700", LOW: "bg-red-100 text-red-700", NONE: "bg-gray-100 text-gray-700" };
const PROVIDER_COLORS: Record<string, string> = { CHROMETA: "bg-blue-100 text-blue-700", WISETIME: "bg-purple-100 text-purple-700", EBILLITY: "bg-green-100 text-green-700" };
const SOURCE_ICONS: Record<string, typeof FileText> = { document: FileText, email: Mail, website: Globe, application: Clock };

function fmt(s: string) { return s?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || ""; }
function secToHours(s: number) { return (Math.round(s / 36) / 100).toFixed(2); }

export default function TimeReviewPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [providerFilter, setProviderFilter] = useState("");

  const { data: entries } = trpc.timeTracking["entries.getUnreviewed"].useQuery(
    providerFilter ? { provider: providerFilter } : undefined
  );
  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const matters = mattersData?.matters || [];

  const reviewMut = trpc.timeTracking["entries.review"].useMutation({
    onSuccess: () => { utils.timeTracking["entries.getUnreviewed"].invalidate(); toast({ title: "Entry reviewed" }); },
  });
  const dismissMut = trpc.timeTracking["entries.dismiss"].useMutation({
    onSuccess: () => { utils.timeTracking["entries.getUnreviewed"].invalidate(); toast({ title: "Entry dismissed" }); },
  });
  const bulkReviewMut = trpc.timeTracking["entries.bulkReview"].useMutation({
    onSuccess: (d) => { utils.timeTracking["entries.getUnreviewed"].invalidate(); toast({ title: `${d.approved} approved, ${d.dismissed} dismissed` }); },
  });

  const highConfidence = (entries || []).filter((e: any) => e.matterMatchConfidence === "HIGH" && e.matterId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/time"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div><h1 className="text-2xl font-bold">Time Entry Review</h1><p className="text-sm text-slate-500">{(entries || []).length} entries awaiting review</p></div>
        </div>
        <div className="flex gap-2">
          {highConfidence.length > 0 && (
            <Button variant="outline" onClick={() => bulkReviewMut.mutate({ entries: highConfidence.map((e: any) => ({ entryId: e.id, approved: true, matterId: e.matterId })) })} disabled={bulkReviewMut.isLoading}>
              <CheckCircle className="h-4 w-4 mr-2" /> Approve All HIGH ({highConfidence.length})
            </Button>
          )}
        </div>
      </div>

      <Select value={providerFilter || "__all__"} onValueChange={(v) => setProviderFilter(v === "__all__" ? "" : v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="All providers" /></SelectTrigger>
        <SelectContent><SelectItem value="__all__">All</SelectItem>{["CHROMETA", "WISETIME", "EBILLITY"].map((p) => <SelectItem key={p} value={p}>{fmt(p)}</SelectItem>)}</SelectContent>
      </Select>

      <div className="space-y-3">
        {(entries || []).map((entry: any) => (
          <Card key={entry.id} className={entry.matterMatchConfidence === "NONE" ? "border-red-200" : entry.matterMatchConfidence === "LOW" ? "border-amber-200" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                {/* Left: Meta */}
                <div className="w-32 flex-shrink-0 space-y-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${PROVIDER_COLORS[entry.provider] || ""}`}>{fmt(entry.provider)}</span>
                  <p className="text-xs text-slate-500">{new Date(entry.date).toLocaleDateString()}</p>
                  {entry.startTime && <p className="text-xs text-slate-400">{new Date(entry.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
                  <p className="text-lg font-bold">{secToHours(entry.duration)}h</p>
                </div>

                {/* Center: Content */}
                <div className="flex-1 space-y-2">
                  {entry.documentName && <p className="text-xs text-slate-500 flex items-center gap-1"><FileText className="h-3 w-3" /> {entry.documentName}</p>}
                  {entry.application && <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" /> {entry.application}</p>}
                  {entry.emailSubject && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" /> {entry.emailSubject}</p>}

                  <Textarea rows={2} className="text-sm" defaultValue={entry.adjustedDescription || entry.description || ""} placeholder="Billing description..." />

                  <div className="flex items-center gap-2">
                    <Select defaultValue={entry.matterId || "__none__"} onValueChange={(v) => {
                      if (v !== "__none__") {
                        const assignMut = trpc.useUtils();
                      }
                    }}>
                      <SelectTrigger className="w-64 text-sm"><SelectValue placeholder="Assign to matter" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {entry.matterMatchConfidence && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${CONFIDENCE_COLORS[entry.matterMatchConfidence] || ""}`}>
                        {entry.matterMatchConfidence} — {entry.matterMatchMethod}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => reviewMut.mutate({ entryId: entry.id, approved: true, matterId: entry.matterId })} disabled={reviewMut.isLoading}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => dismissMut.mutate({ entryId: entry.id })} disabled={dismissMut.isLoading}>
                    <XCircle className="h-3 w-3 mr-1" /> Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!entries?.length && <p className="text-slate-500 text-center py-8">All entries reviewed! Nothing to review right now.</p>}
      </div>
    </div>
  );
}
