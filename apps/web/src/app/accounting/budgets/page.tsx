"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function BudgetsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`);

  const { data: budgets } = trpc.accounting.listBudgets.useQuery({ period });
  const { data: expenseAccounts } = trpc.accounting.listAccounts.useQuery({ type: "EXPENSE" });
  const setBudgetMut = trpc.accounting.setBudget.useMutation({
    onSuccess: () => { utils.accounting.listBudgets.invalidate(); toast({ title: "Budget saved" }); },
  });

  const accountList = expenseAccounts || [];
  const budgetMap: Record<string, any> = {};
  for (const b of budgets || []) budgetMap[b.accountId] = b;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budget Management</h1>
        <div className="flex items-center gap-2">
          <Label>Period:</Label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Budgeted</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {accountList.map((acct: any) => {
                const budget = budgetMap[acct.id];
                const budgeted = budget ? Number(budget.budgetedAmount) : 0;
                const actual = Number(acct.currentBalance);
                const variance = budgeted - actual;
                const pct = budgeted > 0 ? (actual / budgeted) * 100 : 0;

                return (
                  <TableRow key={acct.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-slate-400 mr-2">{acct.accountNumber}</span>
                      {acct.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="w-28 text-right text-sm inline-block"
                        defaultValue={budgeted || ""}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0) setBudgetMut.mutate({ accountId: acct.id, period, amount: val });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono">{cur(actual)}</TableCell>
                    <TableCell className={`text-right font-mono ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {budgeted > 0 ? cur(variance) : "—"}
                    </TableCell>
                    <TableCell className={`text-right ${pct > 100 ? "text-red-600 font-bold" : pct > 80 ? "text-amber-600" : "text-green-600"}`}>
                      {budgeted > 0 ? `${pct.toFixed(0)}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!accountList.length && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No expense accounts. Initialize Chart of Accounts first.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
