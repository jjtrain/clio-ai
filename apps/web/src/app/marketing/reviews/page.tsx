"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Star, Sparkles, Flag, Send, RefreshCw } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = { NEW: "bg-blue-100 text-blue-700", READ: "bg-gray-100 text-gray-700", RESPONDED: "bg-green-100 text-green-700", FLAGGED: "bg-red-100 text-red-700" };
const SENTIMENT_COLORS: Record<string, string> = { POSITIVE: "bg-green-100 text-green-700", NEUTRAL: "bg-gray-100 text-gray-700", NEGATIVE: "bg-red-100 text-red-700" };
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function ReviewsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [platformFilter, setPlatformFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [respondOpen, setRespondOpen] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqEmail, setReqEmail] = useState("");
  const [reqClientId, setReqClientId] = useState("");
  const [reqPlatform, setReqPlatform] = useState("google");

  const { data: reviews } = trpc.marketing["reviews.list"].useQuery({
    platform: platformFilter || undefined,
    rating: ratingFilter ? Number(ratingFilter) : undefined,
  });
  const { data: stats } = trpc.marketing["reviews.stats"].useQuery();
  const { data: requestStats } = trpc.marketing["requests.stats"].useQuery();
  const { data: clientsData } = trpc.clients.list.useQuery({ limit: 100 });
  const clients = clientsData?.clients || [];

  const respondMut = trpc.marketing["reviews.respond"].useMutation({
    onSuccess: () => { utils.marketing["reviews.list"].invalidate(); setRespondOpen(null); setResponseText(""); toast({ title: "Response posted" }); },
  });
  const generateMut = trpc.marketing["reviews.generateResponse"].useMutation({
    onSuccess: (d) => setResponseText(d.response),
  });
  const flagMut = trpc.marketing["reviews.flag"].useMutation({
    onSuccess: () => { utils.marketing["reviews.list"].invalidate(); toast({ title: "Review flagged" }); },
  });
  const syncMut = trpc.marketing["reviews.syncFromProvider"].useMutation({
    onSuccess: (d) => { utils.marketing["reviews.list"].invalidate(); utils.marketing["reviews.stats"].invalidate(); toast({ title: d.success ? `Synced ${(d as any).created || 0} reviews` : (d as any).error }); },
  });
  const requestMut = trpc.marketing["requests.send"].useMutation({
    onSuccess: () => { utils.marketing["requests.list"].invalidate(); setRequestOpen(false); toast({ title: "Review request sent" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Review Management</h1><p className="text-sm text-slate-500">Track, respond, and grow your online reviews</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncMut.mutate({ provider: "BIRDEYE" })} disabled={syncMut.isLoading}><RefreshCw className="h-4 w-4 mr-2" /> Sync Reviews</Button>
          <Button onClick={() => setRequestOpen(true)}><Send className="h-4 w-4 mr-2" /> Request Review</Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Total Reviews</p><p className="text-xl font-bold">{stats.totalReviews}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Avg Rating</p><p className="text-xl font-bold flex items-center gap-1">{stats.avgRating} <Star className="h-4 w-4 text-amber-500 fill-amber-500" /></p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Response Rate</p><p className="text-xl font-bold text-green-600">{stats.responseRate.toFixed(0)}%</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Positive</p><p className="text-xl font-bold text-green-600">{stats.bySentiment.POSITIVE}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-slate-500">Negative</p><p className="text-xl font-bold text-red-600">{stats.bySentiment.NEGATIVE}</p></CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={platformFilter || "__all__"} onValueChange={(v) => setPlatformFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All platforms" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem>{["google","facebook","yelp","avvo","lawyers_com"].map((p) => <SelectItem key={p} value={p}>{fmt(p)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ratingFilter || "__all__"} onValueChange={(v) => setRatingFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All ratings" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem>{[5,4,3,2,1].map((r) => <SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Reviews */}
      <div className="space-y-3">
        {(reviews || []).map((r: any) => (
          <Card key={r.id} className={r.status === "FLAGGED" ? "border-red-200" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{r.reviewerName || "Anonymous"}</span>
                    <Badge variant="secondary" className="text-[10px]">{r.platform}</Badge>
                    <div className="flex">{[1,2,3,4,5].map((s) => <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "text-amber-500 fill-amber-500" : "text-gray-200"}`} />)}</div>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${SENTIMENT_COLORS[r.sentiment] || ""}`}>{r.sentiment}</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status}</span>
                    <span className="text-xs text-slate-400">{new Date(r.reviewDate).toLocaleDateString()}</span>
                  </div>
                  {r.content && <p className="text-sm mt-1">{r.content}</p>}
                  {r.responseText && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm"><strong>Response:</strong> {r.responseText}</div>
                  )}
                </div>
                <div className="flex gap-1 ml-3">
                  {!r.responseText && <Button variant="ghost" size="sm" onClick={() => { setRespondOpen(r.id); setResponseText(""); }}><Sparkles className="h-3 w-3" /></Button>}
                  <Button variant="ghost" size="sm" onClick={() => flagMut.mutate({ reviewId: r.id })}><Flag className="h-3 w-3 text-red-500" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!reviews?.length && <p className="text-slate-500 text-center py-8">No reviews found. Sync from BirdEye or Repsight to import.</p>}
      </div>

      {/* Respond Dialog */}
      <Dialog open={!!respondOpen} onOpenChange={() => { setRespondOpen(null); setResponseText(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Respond to Review</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {["professional", "warm", "apologetic", "brief"].map((t) => (
                <Button key={t} variant="outline" size="sm" onClick={() => respondOpen && generateMut.mutate({ reviewId: respondOpen, tone: t })} disabled={generateMut.isLoading}>
                  <Sparkles className="h-3 w-3 mr-1" /> {fmt(t)}
                </Button>
              ))}
            </div>
            <Textarea rows={4} value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder="Type your response or generate one with AI..." />
            <Button className="w-full" disabled={!responseText || respondMut.isLoading} onClick={() => respondOpen && respondMut.mutate({ reviewId: respondOpen, responseText })}>
              {respondMut.isLoading ? "Posting..." : "Post Response"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Review Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a Review</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Client</Label>
              <Select value={reqClientId} onValueChange={(v) => { setReqClientId(v); const c = clients.find((x: any) => x.id === v); if (c?.email) setReqEmail(c.email); }}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input value={reqEmail} onChange={(e) => setReqEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Platform</Label>
              <Select value={reqPlatform} onValueChange={setReqPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["google","facebook","yelp","avvo"].map((p) => <SelectItem key={p} value={p}>{fmt(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!reqClientId || !reqEmail || requestMut.isLoading} onClick={() => requestMut.mutate({ clientId: reqClientId, email: reqEmail, platform: reqPlatform })}>
              {requestMut.isLoading ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
