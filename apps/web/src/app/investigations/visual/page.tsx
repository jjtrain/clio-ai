"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Eye, CheckCircle, XCircle, AlertTriangle, ExternalLink, Download } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { NEW: "bg-amber-100 text-amber-700", REVIEWED: "bg-blue-100 text-blue-700", CONFIRMED_INFRINGEMENT: "bg-red-100 text-red-700", FALSE_POSITIVE: "bg-gray-100 text-gray-500", TAKEDOWN_REQUESTED: "bg-purple-100 text-purple-700", TAKEDOWN_COMPLETED: "bg-emerald-100 text-emerald-700", MONITORING: "bg-blue-100 text-blue-700" };

export default function VisualAssetsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: matches, isLoading } = trpc.investigations.matches.list.useQuery({ status: statusFilter !== "all" ? statusFilter as any : undefined });
  const reviewMut = trpc.investigations.matches.review.useMutation({ onSuccess: () => { utils.investigations.matches.list.invalidate(); toast({ title: "Match reviewed" }); } });

  const confirmed = (matches || []).filter((m: any) => m.status === "CONFIRMED_INFRINGEMENT").length;
  const takedowns = (matches || []).filter((m: any) => m.status === "TAKEDOWN_COMPLETED").length;
  const needsReview = (matches || []).filter((m: any) => m.status === "NEW").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Visual Asset Matches</h1><p className="text-sm text-slate-500">Logo, trademark, and product image matches from Mediascope</p></div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{(matches || []).length}</p><p className="text-xs text-gray-500">Total Matches</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-red-600">{confirmed}</p><p className="text-xs text-gray-500">Confirmed</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-emerald-600">{takedowns}</p><p className="text-xs text-gray-500">Takedowns</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-amber-600">{needsReview}</p><p className="text-xs text-gray-500">Needs Review</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["NEW", "REVIEWED", "CONFIRMED_INFRINGEMENT", "FALSE_POSITIVE", "TAKEDOWN_REQUESTED", "TAKEDOWN_COMPLETED"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(matches || []).map((m: any) => (
            <Card key={m.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>{m.status.replace(/_/g, " ")}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{m.matchType}</span>
                      {m.platform && <span className="text-xs text-gray-500">{m.platform}</span>}
                    </div>
                    <p className="text-sm font-medium">{m.matchDomain || m.matchPageTitle || "Match"}</p>
                    <p className="text-lg font-bold text-blue-600">{(Number(m.similarityScore) * 100).toFixed(0)}% match</p>
                  </div>
                </div>
                <a href={m.matchUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block mb-2">{m.matchUrl}</a>
                {m.context && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{m.context}</p>}
                {m.sellerInfo && (() => { try { const s = JSON.parse(m.sellerInfo); return s.name ? <p className="text-xs text-gray-600">Seller: {s.name} {s.location ? `(${s.location})` : ""}</p> : null; } catch { return null; } })()}
                <div className="flex gap-1 mt-3">
                  {m.status === "NEW" && (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => reviewMut.mutate({ id: m.id, status: "CONFIRMED_INFRINGEMENT" })}><AlertTriangle className="h-3 w-3 mr-1" /> Infringement</Button>
                      <Button size="sm" variant="outline" onClick={() => reviewMut.mutate({ id: m.id, status: "FALSE_POSITIVE" })}><XCircle className="h-3 w-3 mr-1" /> False Positive</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => window.open(m.matchUrl, "_blank")}><ExternalLink className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!matches || matches.length === 0) && <Card className="col-span-2"><CardContent className="py-12 text-center text-gray-400"><Eye className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No visual matches found.</p></CardContent></Card>}
        </div>
      )}
    </div>
  );
}
