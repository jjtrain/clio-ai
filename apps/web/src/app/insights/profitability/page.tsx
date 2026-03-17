"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, Users, Briefcase, Building2, UserCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

function fmtCurrency(v: number) { if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`; return `$${v.toFixed(0)}`; }
function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }

const SEG_COLORS: Record<string, string> = { A: "bg-emerald-100 text-emerald-700", B: "bg-blue-100 text-blue-700", C: "bg-amber-100 text-amber-700", D: "bg-red-100 text-red-700" };

export default function ProfitabilityPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const now = new Date();
  const [period] = useState(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`);

  const { data: clientRankings, isLoading: loadingClients } = trpc.finInsights["profitability.clientRankings"].useQuery({ period });
  const { data: matterRankings, isLoading: loadingMatters } = trpc.finInsights["profitability.matterRankings"].useQuery({});
  const { data: practiceAreas, isLoading: loadingPA } = trpc.finInsights["profitability.practiceArea"].useQuery({ period });
  const { data: attorneys } = trpc.finInsights["profitability.attorney"].useQuery({ period });
  const { data: segments } = trpc.finInsights["profitability.segment"].useQuery({ period });

  const calcAllMut = trpc.finInsights["profitability.clientAll"].useMutation({
    onSuccess: () => { utils.finInsights["profitability.clientRankings"].invalidate(); utils.finInsights["profitability.segment"].invalidate(); toast({ title: "Profitability calculated" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profitability Analysis</h1>
          <p className="text-sm text-slate-500">Client, matter, and practice area profitability</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => calcAllMut.mutate({ period })} disabled={calcAllMut.isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${calcAllMut.isLoading ? "animate-spin" : ""}`} />
          Calculate All
        </Button>
      </div>

      {/* Segment Overview */}
      {segments && (
        <div className="grid grid-cols-4 gap-4">
          {["A", "B", "C", "D"].map((seg) => (
            <Card key={seg}>
              <CardContent className="pt-6 text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-lg font-bold ${SEG_COLORS[seg]}`}>{seg}</span>
                <p className="text-2xl font-bold mt-2">{(segments as any)[seg]?.count || 0}</p>
                <p className="text-xs text-gray-500">clients</p>
                <p className="text-sm font-medium mt-1">{fmtCurrency((segments as any)[seg]?.revenue || 0)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1" /> By Client</TabsTrigger>
          <TabsTrigger value="matters"><Briefcase className="h-4 w-4 mr-1" /> By Matter</TabsTrigger>
          <TabsTrigger value="practice"><Building2 className="h-4 w-4 mr-1" /> By Practice Area</TabsTrigger>
          <TabsTrigger value="attorney"><UserCircle className="h-4 w-4 mr-1" /> By Attorney</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          {loadingClients ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-gray-500">Client</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Revenue</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Costs</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Net Profit</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Margin</th>
                        <th className="pb-2 font-medium text-gray-500 text-center">Segment</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">LTV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(clientRankings || []).map((cp: any) => (
                        <tr key={cp.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 font-medium">{cp.client?.name || "Unknown"}</td>
                          <td className="py-3 text-right">{fmtCurrency(Number(cp.revenue))}</td>
                          <td className="py-3 text-right">{fmtCurrency(Number(cp.directCosts) + Number(cp.expenses))}</td>
                          <td className="py-3 text-right">
                            <span className={Number(cp.netProfit) >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtCurrency(Number(cp.netProfit))}</span>
                          </td>
                          <td className="py-3 text-right">{fmtPct(Number(cp.profitMargin || 0))}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEG_COLORS[cp.segment || "D"]}`}>{cp.segment || "D"}</span>
                          </td>
                          <td className="py-3 text-right">{fmtCurrency(Number(cp.lifetimeValue || 0))}</td>
                        </tr>
                      ))}
                      {(!clientRankings || clientRankings.length === 0) && (
                        <tr><td colSpan={7} className="py-8 text-center text-gray-400">No data. Click "Calculate All" to generate.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="matters">
          {loadingMatters ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : (
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-gray-500">Matter</th>
                        <th className="pb-2 font-medium text-gray-500">Client</th>
                        <th className="pb-2 font-medium text-gray-500">Practice Area</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Revenue</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Costs</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Profit</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Margin</th>
                        <th className="pb-2 font-medium text-gray-500">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matterRankings || []).map((mp: any) => (
                        <tr key={mp.id} className={`border-b last:border-0 hover:bg-gray-50 ${mp.isOverBudget ? "bg-red-50" : ""}`}>
                          <td className="py-3 font-medium">{mp.matter?.title || "Unknown"}</td>
                          <td className="py-3 text-gray-600">{mp.client?.name || ""}</td>
                          <td className="py-3 text-gray-600">{mp.practiceArea || "-"}</td>
                          <td className="py-3 text-right">{fmtCurrency(Number(mp.totalRevenue))}</td>
                          <td className="py-3 text-right">{fmtCurrency(Number(mp.totalCosts))}</td>
                          <td className="py-3 text-right">
                            <span className={Number(mp.netProfit) >= 0 ? "text-emerald-600" : "text-red-600"}>{fmtCurrency(Number(mp.netProfit))}</span>
                          </td>
                          <td className="py-3 text-right">{fmtPct(Number(mp.profitMargin || 0))}</td>
                          <td className="py-3"><span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{mp.billingType || "-"}</span></td>
                        </tr>
                      ))}
                      {(!matterRankings || matterRankings.length === 0) && (
                        <tr><td colSpan={8} className="py-8 text-center text-gray-400">No data available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="practice">
          {loadingPA ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : (
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-sm">Revenue & Profit by Practice Area</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={(practiceAreas || []).map((pa: any) => ({ name: pa.practiceArea || "Other", revenue: Number(pa._sum?.totalRevenue || 0), profit: Number(pa._sum?.netProfit || 0), count: pa._count }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => fmtCurrency(v)} />
                      <Tooltip formatter={(v: any) => `$${Number(v || 0).toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
                      <Bar dataKey="profit" fill="#10B981" name="Profit" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-gray-500">Practice Area</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Matters</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Revenue</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Profit</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Avg Margin</th>
                        <th className="pb-2 font-medium text-gray-500 text-right">Avg Realization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(practiceAreas || []).map((pa: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-3 font-medium">{pa.practiceArea || "Other"}</td>
                          <td className="py-3 text-right">{pa._count}</td>
                          <td className="py-3 text-right">{fmtCurrency(Number(pa._sum?.totalRevenue || 0))}</td>
                          <td className="py-3 text-right">{fmtCurrency(Number(pa._sum?.netProfit || 0))}</td>
                          <td className="py-3 text-right">{fmtPct(Number(pa._avg?.profitMargin || 0))}</td>
                          <td className="py-3 text-right">{fmtPct(Number(pa._avg?.realizationRate || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="attorney">
          <Card>
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-gray-500">Attorney</th>
                    <th className="pb-2 font-medium text-gray-500 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {(attorneys || []).map((a: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 font-medium">{a.attorney}</td>
                      <td className="py-3 text-right">{fmtCurrency(a.amount)}</td>
                    </tr>
                  ))}
                  {(!attorneys || attorneys.length === 0) && (
                    <tr><td colSpan={2} className="py-8 text-center text-gray-400">No data available.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
