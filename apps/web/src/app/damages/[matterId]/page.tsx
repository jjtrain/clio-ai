"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Plus, Sparkles, Trash2, Edit, Star, AlertTriangle,
  Clock, Briefcase, Heart, Gavel, Activity,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  MEDICAL_EXPENSES: "bg-red-100 text-red-700",
  LOST_WAGES: "bg-blue-100 text-blue-700",
  FUTURE_MEDICAL: "bg-red-50 text-red-600",
  FUTURE_LOST_EARNINGS: "bg-blue-50 text-blue-600",
  PROPERTY_DAMAGE: "bg-amber-100 text-amber-700",
  OUT_OF_POCKET: "bg-orange-100 text-orange-700",
  LOSS_OF_CONSORTIUM: "bg-pink-100 text-pink-700",
  PAIN_AND_SUFFERING: "bg-purple-100 text-purple-700",
  EMOTIONAL_DISTRESS: "bg-purple-50 text-purple-600",
  LOSS_OF_ENJOYMENT: "bg-teal-100 text-teal-700",
  DISFIGUREMENT: "bg-rose-100 text-rose-700",
  DISABILITY: "bg-indigo-100 text-indigo-700",
  WRONGFUL_DEATH: "bg-slate-100 text-slate-700",
  PUNITIVE: "bg-red-100 text-red-700",
  STATUTORY_PENALTY: "bg-amber-100 text-amber-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const CATEGORY_COLORS: Record<string, string> = {
  ECONOMIC: "bg-green-100 text-green-700",
  NON_ECONOMIC: "bg-purple-100 text-purple-700",
  PUNITIVE: "bg-red-100 text-red-700",
  STATUTORY: "bg-blue-100 text-blue-700",
};

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  ECONOMIC: "border-green-300",
  NON_ECONOMIC: "border-purple-300",
  PUNITIVE: "border-red-300",
  STATUTORY: "border-blue-300",
};

const VERIFICATION_COLORS: Record<string, string> = {
  UNVERIFIED: "bg-gray-100 text-gray-600",
  DOCUMENTED: "bg-blue-100 text-blue-700",
  EXPERT_VERIFIED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
};

const TIMELINE_CATEGORY_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  medical: { icon: Activity, color: "text-red-500 bg-red-50" },
  employment: { icon: Briefcase, color: "text-blue-500 bg-blue-50" },
  personal: { icon: Heart, color: "text-purple-500 bg-purple-50" },
  legal: { icon: Gavel, color: "text-amber-500 bg-amber-50" },
};

const ECONOMIC_TYPES = ["MEDICAL_EXPENSES", "LOST_WAGES", "FUTURE_MEDICAL", "FUTURE_LOST_EARNINGS", "PROPERTY_DAMAGE", "OUT_OF_POCKET"];
const NON_ECONOMIC_TYPES = ["PAIN_AND_SUFFERING", "EMOTIONAL_DISTRESS", "LOSS_OF_ENJOYMENT", "DISFIGUREMENT", "DISABILITY", "LOSS_OF_CONSORTIUM", "WRONGFUL_DEATH"];
const ALL_TYPES = [...ECONOMIC_TYPES, ...NON_ECONOMIC_TYPES, "PUNITIVE", "STATUTORY_PENALTY", "OTHER"];
const CATEGORIES = ["ECONOMIC", "NON_ECONOMIC", "PUNITIVE", "STATUTORY"] as const;
const VERIFICATIONS = ["UNVERIFIED", "DOCUMENTED", "EXPERT_VERIFIED", "DISPUTED"] as const;

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DamagesTrackerPage() {
  const { matterId } = useParams<{ matterId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("summary");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [addItemCategory, setAddItemCategory] = useState<string>("ECONOMIC");
  const [addTimelineOpen, setAddTimelineOpen] = useState(false);
  const [multiplierVal, setMultiplierVal] = useState("");
  const [perDiemRate, setPerDiemRate] = useState("");
  const [perDiemDays, setPerDiemDays] = useState("");
  const [calcMethod, setCalcMethod] = useState<"multiplier" | "perDiem">("multiplier");
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [comparables, setComparables] = useState<any[] | null>(null);

  // ─── Queries ─────────────────────────────────────────────────
  const { data: matter } = trpc.matters.getById.useQuery({ id: matterId });
  const { data: itemsData } = trpc.damages.listItems.useQuery({ matterId });
  const { data: summary, refetch: refetchSummary } = trpc.damages.getSummary.useQuery({ matterId });
  const { data: timeline } = trpc.damages.listTimeline.useQuery({ matterId });

  // ─── Mutations ───────────────────────────────────────────────
  const createItem = trpc.damages.createItem.useMutation({
    onSuccess: () => { invalidateAll(); setAddItemOpen(false); toast({ title: "Damage item added" }); },
  });
  const updateItem = trpc.damages.updateItem.useMutation({
    onSuccess: () => { invalidateAll(); setEditItemId(null); toast({ title: "Damage item updated" }); },
  });
  const deleteItem = trpc.damages.deleteItem.useMutation({
    onSuccess: () => { invalidateAll(); toast({ title: "Damage item deleted" }); },
  });
  const setMultiplier = trpc.damages.setMultiplier.useMutation({
    onSuccess: () => { refetchSummary(); toast({ title: "Multiplier applied" }); },
  });
  const setPerDiem = trpc.damages.setPerDiem.useMutation({
    onSuccess: () => { refetchSummary(); toast({ title: "Per diem applied" }); },
  });
  const aiAssess = trpc.damages.aiAssess.useMutation({
    onSuccess: () => { invalidateAll(); toast({ title: "AI assessment complete" }); },
  });
  const aiProjectFuture = trpc.damages.aiProjectFuture.useMutation({
    onSuccess: () => { invalidateAll(); toast({ title: "Future damages projected" }); },
  });
  const genReport = trpc.damages.generateReport.useMutation({
    onSuccess: (data) => { setReportHtml(data.report); toast({ title: "Report generated" }); },
  });
  const getComps = trpc.damages.getComparables.useMutation({
    onSuccess: (data) => { setComparables(data); toast({ title: "Comparables found" }); },
  });
  const addTimeline = trpc.damages.addTimelineEntry.useMutation({
    onSuccess: () => { utils.damages.listTimeline.invalidate({ matterId }); setAddTimelineOpen(false); toast({ title: "Timeline entry added" }); },
  });
  const deleteTimeline = trpc.damages.deleteTimelineEntry.useMutation({
    onSuccess: () => utils.damages.listTimeline.invalidate({ matterId }),
  });
  const autoTimeline = trpc.damages.autoGenerateTimeline.useMutation({
    onSuccess: (data) => { utils.damages.listTimeline.invalidate({ matterId }); toast({ title: `Generated ${data.count} timeline entries` }); },
  });

  function invalidateAll() {
    utils.damages.listItems.invalidate({ matterId });
    utils.damages.getSummary.invalidate({ matterId });
  }

  const allItems = itemsData?.items || [];
  const grouped = itemsData?.grouped || {};
  const editingItem = editItemId ? allItems.find((i: any) => i.id === editItemId) : null;

  // Summary values
  const totalEcon = Number(summary?.totalEconomic || 0);
  const totalNonEcon = Number(summary?.totalNonEconomic || 0);
  const totalPunit = Number(summary?.totalPunitive || 0);
  const totalStat = Number(summary?.totalStatutory || 0);
  const grandTotal = Number(summary?.grandTotal || 0);
  const totalProj = Number(summary?.totalProjected || 0);
  const totalDoc = Number(summary?.totalDocumented || 0);

  if (!matter) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/injury/${matterId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Damages Tracker</h1>
          <p className="text-sm text-slate-500">{matter.name} — {matter.client?.name}</p>
        </div>
        <Button variant="outline" onClick={() => aiAssess.mutate({ matterId })} disabled={aiAssess.isLoading}>
          <Sparkles className="h-4 w-4 mr-1" /> {aiAssess.isLoading ? "Assessing..." : "AI Assess Damages"}
        </Button>
        <Button variant="outline" onClick={() => genReport.mutate({ matterId })} disabled={genReport.isLoading}>
          {genReport.isLoading ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="economic">Economic</TabsTrigger>
          <TabsTrigger value="noneconomic">Non-Economic</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="comparables">Comparables</TabsTrigger>
        </TabsList>

        {/* ═══ SUMMARY TAB ═══ */}
        <TabsContent value="summary" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="border-green-300">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Total Economic</p>
                <p className="text-lg font-bold text-green-700">{cur(totalEcon)}</p>
              </CardContent>
            </Card>
            <Card className="border-purple-300">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Total Non-Economic</p>
                <p className="text-lg font-bold text-purple-700">{cur(totalNonEcon)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-300">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Total Punitive</p>
                <p className="text-lg font-bold text-red-700">{cur(totalPunit)}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-300">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Grand Total</p>
                <p className="text-xl font-bold text-blue-700">{cur(grandTotal)}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-300">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Projected Future</p>
                <p className="text-lg font-bold text-amber-700">{cur(totalProj)}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-300">
              <CardContent className="pt-4">
                <p className="text-xs text-slate-500">Documented</p>
                <p className="text-lg font-bold text-emerald-700">{cur(totalDoc)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Damages Breakdown Bar */}
          <Card>
            <CardHeader><CardTitle>Damages Breakdown</CardTitle></CardHeader>
            <CardContent>
              {grandTotal > 0 ? (
                <div className="space-y-3">
                  <div className="flex h-8 rounded-full overflow-hidden">
                    {totalEcon > 0 && <div className="bg-green-500" style={{ width: `${(totalEcon / grandTotal) * 100}%` }} title={`Economic: ${cur(totalEcon)}`} />}
                    {totalNonEcon > 0 && <div className="bg-purple-500" style={{ width: `${(totalNonEcon / grandTotal) * 100}%` }} title={`Non-Economic: ${cur(totalNonEcon)}`} />}
                    {totalPunit > 0 && <div className="bg-red-500" style={{ width: `${(totalPunit / grandTotal) * 100}%` }} title={`Punitive: ${cur(totalPunit)}`} />}
                    {totalStat > 0 && <div className="bg-blue-500" style={{ width: `${(totalStat / grandTotal) * 100}%` }} title={`Statutory: ${cur(totalStat)}`} />}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500" /> Economic: {cur(totalEcon)} ({((totalEcon / grandTotal) * 100).toFixed(1)}%)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500" /> Non-Economic: {cur(totalNonEcon)} ({((totalNonEcon / grandTotal) * 100).toFixed(1)}%)</span>
                    {totalPunit > 0 && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> Punitive: {cur(totalPunit)}</span>}
                    {totalStat > 0 && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500" /> Statutory: {cur(totalStat)}</span>}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">No damages recorded yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Damages by Type */}
          {allItems.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Damages by Type</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(
                    allItems.reduce((acc: Record<string, number>, item: any) => {
                      acc[item.type] = (acc[item.type] || 0) + Number(item.amount);
                      return acc;
                    }, {})
                  )
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([type, amount]) => (
                      <div key={type} className="flex items-center gap-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-40 justify-center ${DAMAGE_TYPE_COLORS[type] || ""}`}>
                          {fmt(type)}
                        </span>
                        <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              ECONOMIC_TYPES.includes(type) ? "bg-green-400" :
                              NON_ECONOMIC_TYPES.includes(type) ? "bg-purple-400" : "bg-red-400"
                            }`}
                            style={{ width: `${Math.min(100, (Number(amount) / grandTotal) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-32 text-right">{cur(amount as number)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Multiplier Calculator */}
          <Card>
            <CardHeader><CardTitle>Non-Economic Damages Calculator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">Medical Specials Total: <span className="font-bold text-slate-900">{cur(totalEcon)}</span></p>

              <div className="flex gap-2 mb-4">
                <Button variant={calcMethod === "multiplier" ? "default" : "outline"} size="sm" onClick={() => setCalcMethod("multiplier")}>
                  Multiplier Method
                </Button>
                <Button variant={calcMethod === "perDiem" ? "default" : "outline"} size="sm" onClick={() => setCalcMethod("perDiem")}>
                  Per Diem Method
                </Button>
              </div>

              {calcMethod === "multiplier" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Label className="w-20">Multiplier:</Label>
                    <Input
                      type="range"
                      min="1"
                      max="5"
                      step="0.1"
                      className="flex-1"
                      value={multiplierVal || Number(summary?.multiplier || 3)}
                      onChange={(e) => setMultiplierVal(e.target.value)}
                    />
                    <span className="text-lg font-bold w-16 text-center">{multiplierVal || Number(summary?.multiplier || 3)}x</span>
                  </div>
                  <div className="flex gap-2">
                    {[{ label: "Minor (1.5x)", val: 1.5 }, { label: "Moderate (2.5x)", val: 2.5 }, { label: "Serious (3.5x)", val: 3.5 }, { label: "Severe (5x)", val: 5 }].map((p) => (
                      <Button key={p.val} variant="outline" size="sm" onClick={() => setMultiplierVal(String(p.val))}>{p.label}</Button>
                    ))}
                  </div>
                  <p className="text-lg">Estimated General Damages: <span className="font-bold text-purple-700">{cur(totalEcon * Number(multiplierVal || summary?.multiplier || 3))}</span></p>
                  <Button size="sm" onClick={() => setMultiplier.mutate({ matterId, multiplier: Number(multiplierVal || 3) })}>
                    Apply Multiplier
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1"><Label>Daily Rate</Label><Input type="number" step="0.01" placeholder="150.00" value={perDiemRate || (summary?.perDiem ? Number(summary.perDiem) : "")} onChange={(e) => setPerDiemRate(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Number of Days</Label><Input type="number" placeholder="365" value={perDiemDays || (summary?.perDiemDays ?? "")} onChange={(e) => setPerDiemDays(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Total</Label><Input readOnly className="bg-slate-50 font-bold" value={cur((Number(perDiemRate) || 0) * (Number(perDiemDays) || 0))} /></div>
                  </div>
                  <Button size="sm" onClick={() => setPerDiem.mutate({ matterId, dailyRate: Number(perDiemRate) || 0, days: Number(perDiemDays) || 0 })}>
                    Apply Per Diem
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Table */}
          <Card>
            <CardHeader><CardTitle>Quick Summary</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Documented</TableHead>
                    <TableHead className="text-right">Projected</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CATEGORIES.map((cat) => {
                    const catItems = (grouped as any)[cat]?.items || [];
                    const documented = catItems.filter((i: any) => !i.isProjected).reduce((s: number, i: any) => s + Number(i.amount), 0);
                    const projected = catItems.filter((i: any) => i.isProjected).reduce((s: number, i: any) => s + Number(i.amount), 0);
                    return (
                      <TableRow key={cat}>
                        <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>{fmt(cat)}</span></TableCell>
                        <TableCell className="text-right">{cur(documented)}</TableCell>
                        <TableCell className="text-right">{cur(projected)}</TableCell>
                        <TableCell className="text-right font-medium">{cur(documented + projected)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold">
                    <TableCell>Grand Total</TableCell>
                    <TableCell className="text-right">{cur(totalDoc)}</TableCell>
                    <TableCell className="text-right">{cur(totalProj)}</TableCell>
                    <TableCell className="text-right text-lg">{cur(grandTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {summary?.aiAnalysis && (
            <Card>
              <CardHeader><CardTitle>AI Valuation Analysis</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-bold mb-2">AI Estimated Value: {cur(Number(summary.aiValuation))}</p>
                <p className="text-sm whitespace-pre-wrap">{summary.aiAnalysis}</p>
              </CardContent>
            </Card>
          )}

          {/* Report */}
          {reportHtml && (
            <Card>
              <CardHeader><CardTitle>Damages Summary Report</CardTitle></CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: reportHtml }} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ ECONOMIC TAB ═══ */}
        <TabsContent value="economic" className="space-y-6">
          <div className="flex gap-2">
            <Button onClick={() => { setAddItemCategory("ECONOMIC"); setAddItemOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Economic Damage
            </Button>
            <Button variant="outline" onClick={() => aiProjectFuture.mutate({ matterId })} disabled={aiProjectFuture.isLoading}>
              <Sparkles className="h-4 w-4 mr-1" /> {aiProjectFuture.isLoading ? "Projecting..." : "AI Project Future"}
            </Button>
          </div>

          <DamagesTable
            items={allItems.filter((i: any) => i.category === "ECONOMIC")}
            onEdit={setEditItemId}
            onDelete={(id: string) => { if (confirm("Delete this item?")) deleteItem.mutate({ id }); }}
          />

          {/* Lost Wages Calculator */}
          <LostWagesCalculator onAdd={(data) => {
            createItem.mutate({ matterId, category: "ECONOMIC", ...data });
          }} />
        </TabsContent>

        {/* ═══ NON-ECONOMIC TAB ═══ */}
        <TabsContent value="noneconomic" className="space-y-6">
          <div className="flex gap-2">
            <Button onClick={() => { setAddItemCategory("NON_ECONOMIC"); setAddItemOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Non-Economic Damage
            </Button>
            <Button variant="outline" onClick={() => aiAssess.mutate({ matterId })} disabled={aiAssess.isLoading}>
              <Sparkles className="h-4 w-4 mr-1" /> AI Estimate Non-Economic
            </Button>
          </div>

          <DamagesTable
            items={allItems.filter((i: any) => i.category === "NON_ECONOMIC" || i.category === "PUNITIVE" || i.category === "STATUTORY")}
            onEdit={setEditItemId}
            onDelete={(id: string) => { if (confirm("Delete this item?")) deleteItem.mutate({ id }); }}
          />
        </TabsContent>

        {/* ═══ TIMELINE TAB ═══ */}
        <TabsContent value="timeline" className="space-y-6">
          <div className="flex gap-2">
            <Button onClick={() => setAddTimelineOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Event</Button>
            <Button variant="outline" onClick={() => autoTimeline.mutate({ matterId })} disabled={autoTimeline.isLoading}>
              {autoTimeline.isLoading ? "Generating..." : "Auto-Generate Timeline"}
            </Button>
          </div>

          {/* Vertical Timeline */}
          <div className="relative">
            {timeline && timeline.length > 0 ? (
              <div className="space-y-0">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
                {timeline.map((entry: any) => {
                  const catInfo = TIMELINE_CATEGORY_ICONS[entry.category || "legal"] || TIMELINE_CATEGORY_ICONS.legal;
                  const Icon = catInfo.icon;
                  return (
                    <div key={entry.id} className="relative flex gap-4 pb-6">
                      <div className={`z-10 flex h-12 w-12 items-center justify-center rounded-full ${catInfo.color} flex-shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{new Date(entry.date).toLocaleDateString()}</span>
                          {entry.category && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{entry.category}</span>
                          )}
                          <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => deleteTimeline.mutate({ id: entry.id })}>
                            <Trash2 className="h-3 w-3 text-slate-400" />
                          </Button>
                        </div>
                        <p className="text-sm text-slate-700 mt-0.5">{entry.event}</p>
                        {entry.damageImpact && (
                          <p className="text-xs text-slate-500 mt-1 italic">{entry.damageImpact}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No timeline entries yet. Add events or auto-generate from records.</p>
            )}
          </div>

          {/* Add Timeline Dialog */}
          <TimelineDialog
            open={addTimelineOpen}
            onClose={() => setAddTimelineOpen(false)}
            onSubmit={(data) => addTimeline.mutate({ matterId, ...data })}
            isLoading={addTimeline.isLoading}
          />
        </TabsContent>

        {/* ═══ COMPARABLES TAB ═══ */}
        <TabsContent value="comparables" className="space-y-6">
          <div className="flex gap-2">
            <Button onClick={() => getComps.mutate({ matterId })} disabled={getComps.isLoading}>
              <Sparkles className="h-4 w-4 mr-1" /> {getComps.isLoading ? "Searching..." : "Find Comparable Verdicts"}
            </Button>
          </div>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  These are AI-generated references and must be independently verified. They do not constitute legal advice or guarantee of outcome. Always verify through official legal databases.
                </p>
              </div>
            </CardContent>
          </Card>

          {comparables && comparables.length > 0 ? (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case Name</TableHead>
                      <TableHead>Verdict/Settlement</TableHead>
                      <TableHead>Injuries</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Relevance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparables.map((comp: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{comp.caseName}</TableCell>
                        <TableCell className="font-bold text-green-700">{comp.verdict}</TableCell>
                        <TableCell className="max-w-[200px]">{comp.injuries}</TableCell>
                        <TableCell>{comp.year}</TableCell>
                        <TableCell className="max-w-[200px] text-sm text-slate-600">{comp.relevance}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : !getComps.isLoading ? (
            <p className="text-slate-500 text-center py-8">Click "Find Comparable Verdicts" to search for similar cases.</p>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Item Dialog */}
      <DamageItemDialog
        open={addItemOpen || !!editItemId}
        onClose={() => { setAddItemOpen(false); setEditItemId(null); }}
        item={editingItem}
        defaultCategory={addItemCategory}
        onSubmit={(data: any) => {
          if (editItemId) {
            updateItem.mutate({ id: editItemId, ...data });
          } else {
            createItem.mutate({ matterId, ...data });
          }
        }}
        isLoading={createItem.isLoading || updateItem.isLoading}
      />
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────

function DamagesTable({ items, onEdit, onDelete }: { items: any[]; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${DAMAGE_TYPE_COLORS[item.type] || ""}`}>
                      {fmt(item.type)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate">{item.description}</TableCell>
                  <TableCell className="text-right font-medium">{cur(item.amount)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {item.startDate ? new Date(item.startDate).toLocaleDateString() : "—"}
                    {item.endDate ? ` - ${new Date(item.endDate).toLocaleDateString()}` : item.isOngoing ? " - Ongoing" : ""}
                  </TableCell>
                  <TableCell>
                    {item.isProjected && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <Star className="h-3 w-3" /> Projected
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${VERIFICATION_COLORS[item.verificationStatus] || ""}`}>
                      {fmt(item.verificationStatus)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}><Edit className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No items yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function DamageItemDialog({ open, onClose, item, defaultCategory, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>(() => {
    if (item) return {
      category: item.category,
      type: item.type,
      description: item.description || "",
      amount: Number(item.amount) || "",
      isProjected: item.isProjected || false,
      startDate: item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "",
      endDate: item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "",
      isOngoing: item.isOngoing || false,
      frequency: item.frequency || "",
      recurringAmount: item.recurringAmount ? Number(item.recurringAmount) : "",
      duration: item.duration ?? "",
      verificationStatus: item.verificationStatus || "UNVERIFIED",
      notes: item.notes || "",
    };
    return {
      category: defaultCategory || "ECONOMIC",
      type: defaultCategory === "NON_ECONOMIC" ? "PAIN_AND_SUFFERING" : "MEDICAL_EXPENSES",
      description: "", amount: "", isProjected: false,
      startDate: "", endDate: "", isOngoing: false,
      frequency: "", recurringAmount: "", duration: "",
      verificationStatus: "UNVERIFIED", notes: "",
    };
  });

  const typeOptions = form.category === "ECONOMIC" ? ECONOMIC_TYPES
    : form.category === "NON_ECONOMIC" ? NON_ECONOMIC_TYPES
    : form.category === "PUNITIVE" ? ["PUNITIVE"]
    : form.category === "STATUTORY" ? ["STATUTORY_PENALTY"]
    : ALL_TYPES;

  // Auto-calculate recurring total
  const recurringTotal = form.recurringAmount && form.duration ? Number(form.recurringAmount) * Number(form.duration) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? "Edit Damage Item" : "Add Damage Item"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{fmt(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{typeOptions.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2"><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Amount *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Verification</Label>
              <Select value={form.verificationStatus} onValueChange={(v) => setForm({ ...form, verificationStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VERIFICATIONS.map((v) => <SelectItem key={v} value={v}>{fmt(v)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isProjected} onChange={(e) => setForm({ ...form, isProjected: e.target.checked })} className="rounded" />
              Projected (future damage)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isOngoing} onChange={(e) => setForm({ ...form, isOngoing: e.target.checked })} className="rounded" />
              Ongoing
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} disabled={form.isOngoing} /></div>
          </div>

          {form.isProjected && (
            <div className="grid grid-cols-3 gap-4 p-3 bg-amber-50 rounded-lg">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={form.frequency || ""} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Per-Period Amount</Label><Input type="number" step="0.01" value={form.recurringAmount} onChange={(e) => setForm({ ...form, recurringAmount: e.target.value })} /></div>
              <div className="space-y-2"><Label># Periods</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
              {recurringTotal && <p className="col-span-3 text-sm font-medium">Calculated Total: {cur(recurringTotal)}</p>}
            </div>
          )}

          <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={isLoading || !form.description || !form.amount}
              onClick={() => {
                onSubmit({
                  category: form.category,
                  type: form.type,
                  description: form.description,
                  amount: recurringTotal || Number(form.amount),
                  isProjected: form.isProjected,
                  startDate: form.startDate || undefined,
                  endDate: form.endDate || undefined,
                  isOngoing: form.isOngoing,
                  frequency: form.frequency || undefined,
                  recurringAmount: form.recurringAmount ? Number(form.recurringAmount) : undefined,
                  duration: form.duration ? Number(form.duration) : undefined,
                  verificationStatus: form.verificationStatus,
                  notes: form.notes || undefined,
                });
              }}
            >
              {isLoading ? "Saving..." : item ? "Update" : "Add Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LostWagesCalculator({ onAdd }: { onAdd: (data: any) => void }) {
  const [salary, setSalary] = useState("");
  const [missedDays, setMissedDays] = useState("");
  const dailyRate = salary ? Number(salary) / 260 : 0; // ~260 working days/year
  const total = dailyRate * (Number(missedDays) || 0);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Lost Wages Calculator</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 items-end">
          <div className="space-y-1"><Label className="text-xs">Annual Salary</Label><Input type="number" step="0.01" placeholder="75000" value={salary} onChange={(e) => setSalary(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Work Days Missed</Label><Input type="number" placeholder="30" value={missedDays} onChange={(e) => setMissedDays(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Calculated</Label><Input readOnly className="bg-slate-50 font-bold" value={total > 0 ? cur(total) : "—"} /></div>
          <Button
            size="sm"
            disabled={!total}
            onClick={() => {
              onAdd({
                type: "LOST_WAGES",
                description: `Lost wages: ${missedDays} work days missed at $${Number(salary).toLocaleString()}/year ($${dailyRate.toFixed(2)}/day)`,
                amount: Number(total.toFixed(2)),
                verificationStatus: "UNVERIFIED",
              });
              setSalary("");
              setMissedDays("");
            }}
          >
            Add as Damage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineDialog({ open, onClose, onSubmit, isLoading }: any) {
  const [form, setForm] = useState({ date: "", event: "", damageImpact: "", category: "medical" });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Timeline Event</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="employment">Employment</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Event *</Label><Input value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} /></div>
          <div className="space-y-2"><Label>Damage Impact</Label><Textarea rows={2} value={form.damageImpact} onChange={(e) => setForm({ ...form, damageImpact: e.target.value })} /></div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isLoading || !form.date || !form.event} onClick={() => {
              onSubmit({ date: form.date, event: form.event, damageImpact: form.damageImpact || undefined, category: form.category });
              setForm({ date: "", event: "", damageImpact: "", category: "medical" });
            }}>
              {isLoading ? "Saving..." : "Add Event"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
