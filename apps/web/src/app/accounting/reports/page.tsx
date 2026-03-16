"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function ReportsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [activeReport, setActiveReport] = useState("pl");

  const { data: pl, refetch: fetchPl } = trpc.accounting.profitAndLoss.useQuery({ startDate, endDate }, { enabled: activeReport === "pl" });
  const { data: bs, refetch: fetchBs } = trpc.accounting.balanceSheet.useQuery({ asOfDate: endDate }, { enabled: activeReport === "bs" });
  const { data: tb, refetch: fetchTb } = trpc.accounting.trialBalance.useQuery({ asOfDate: endDate }, { enabled: activeReport === "tb" });
  const { data: expenses, refetch: fetchExp } = trpc.accounting.expenseReport.useQuery({ startDate, endDate }, { enabled: activeReport === "expenses" });
  const { data: byClient } = trpc.accounting.incomeByClient.useQuery({ startDate, endDate }, { enabled: activeReport === "clients" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financial Reports</h1>

      <div className="flex gap-4 items-end">
        <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="space-y-2"><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>

      <Tabs value={activeReport} onValueChange={setActiveReport}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="tb">Trial Balance</TabsTrigger>
          <TabsTrigger value="expenses">Expense Report</TabsTrigger>
          <TabsTrigger value="clients">Income by Client</TabsTrigger>
        </TabsList>

        <TabsContent value="pl">
          {pl && (
            <Card>
              <CardHeader><CardTitle>Profit & Loss Statement</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div><h3 className="font-bold text-green-700 mb-2">Revenue</h3>
                    {pl.revenue.map((r: any, i: number) => <div key={i} className="flex justify-between py-1 text-sm"><span>{r.account}</span><span className="font-mono">{cur(r.amount)}</span></div>)}
                    <div className="flex justify-between py-1 font-bold border-t"><span>Total Revenue</span><span className="font-mono text-green-700">{cur(pl.totalRevenue)}</span></div>
                  </div>
                  <div><h3 className="font-bold text-red-700 mb-2">Expenses</h3>
                    {pl.expenses.map((e: any, i: number) => <div key={i} className="flex justify-between py-1 text-sm"><span>{e.account}</span><span className="font-mono">{cur(e.amount)}</span></div>)}
                    <div className="flex justify-between py-1 font-bold border-t"><span>Total Expenses</span><span className="font-mono text-red-700">{cur(pl.totalExpenses)}</span></div>
                  </div>
                  <div className="flex justify-between py-2 text-xl font-bold border-t-2">
                    <span>Net Income</span><span className={pl.netIncome >= 0 ? "text-green-700" : "text-red-700"}>{cur(pl.netIncome)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bs">
          {bs && (
            <Card>
              <CardHeader><CardTitle>Balance Sheet</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-bold text-blue-700 mb-2">Assets</h3>
                    {bs.assets.map((a: any, i: number) => <div key={i} className="flex justify-between py-1 text-sm"><span>{a.number} {a.account}</span><span className="font-mono">{cur(a.balance)}</span></div>)}
                    <div className="flex justify-between py-1 font-bold border-t"><span>Total Assets</span><span className="font-mono">{cur(bs.totalAssets)}</span></div>
                  </div>
                  <div>
                    <h3 className="font-bold text-red-700 mb-2">Liabilities</h3>
                    {bs.liabilities.map((l: any, i: number) => <div key={i} className="flex justify-between py-1 text-sm"><span>{l.number} {l.account}</span><span className="font-mono">{cur(l.balance)}</span></div>)}
                    <div className="flex justify-between py-1 font-bold border-t"><span>Total Liabilities</span><span className="font-mono">{cur(bs.totalLiabilities)}</span></div>
                    <h3 className="font-bold text-purple-700 mb-2 mt-4">Equity</h3>
                    {bs.equity.map((e: any, i: number) => <div key={i} className="flex justify-between py-1 text-sm"><span>{e.number} {e.account}</span><span className="font-mono">{cur(e.balance)}</span></div>)}
                    <div className="flex justify-between py-1 font-bold border-t"><span>Total Equity</span><span className="font-mono">{cur(bs.totalEquity)}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tb">
          {tb && (
            <Card>
              <CardHeader><CardTitle>Trial Balance</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {tb.map((a: any, i: number) => (
                      <TableRow key={i}><TableCell className="font-mono">{a.number}</TableCell><TableCell>{a.name}</TableCell><TableCell className="text-xs">{a.type}</TableCell><TableCell className="text-right font-mono">{a.debit ? cur(a.debit) : ""}</TableCell><TableCell className="text-right font-mono">{a.credit ? cur(a.credit) : ""}</TableCell></TableRow>
                    ))}
                    <TableRow className="font-bold"><TableCell colSpan={3}>Totals</TableCell><TableCell className="text-right font-mono">{cur(tb.reduce((s: number, a: any) => s + a.debit, 0))}</TableCell><TableCell className="text-right font-mono">{cur(tb.reduce((s: number, a: any) => s + a.credit, 0))}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expenses">
          {expenses && (
            <Card>
              <CardHeader><CardTitle>Expense Report — {cur(expenses.total)}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  {Object.entries(expenses.byCategory).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between py-1 text-sm"><span>{cat.replace(/_/g, " ")}</span><span className="font-mono">{cur(amt as number)}</span></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clients">
          {byClient && (
            <Card>
              <CardHeader><CardTitle>Income by Client</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Client</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {byClient.map((c: any, i: number) => (
                      <TableRow key={i}><TableCell>{c.name}</TableCell><TableCell className="text-right font-mono font-medium">{cur(c.amount)}</TableCell></TableRow>
                    ))}
                    {!byClient.length && <TableRow><TableCell colSpan={2} className="text-center text-slate-500 py-4">No revenue data</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
