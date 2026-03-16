"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Upload, CheckCircle } from "lucide-react";

export default function CSVImportPage() {
  return <Suspense fallback={<div className="p-6">Loading...</div>}><CSVImportContent /></Suspense>;
}

function CSVImportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const { data: bankAccounts } = trpc.accounting.listBankAccounts.useQuery();
  const parseMut = trpc.reconciliation.parseCSV.useMutation({
    onSuccess: (d) => toast({ title: `Imported ${d.imported} of ${d.total} transactions` }),
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [step, setStep] = useState(1);
  const [bankAccountId, setBankAccountId] = useState(searchParams.get("bankAccountId") || "");
  const [csvContent, setCsvContent] = useState("");
  const [dateCol, setDateCol] = useState("0");
  const [descCol, setDescCol] = useState("1");
  const [amountCol, setAmountCol] = useState("2");

  const preview = csvContent ? csvContent.split("\n").slice(0, 6).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))) : [];
  const headers = preview[0] || [];
  const accountList = Array.isArray(bankAccounts) ? bankAccounts : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/accounting/reconcile"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">Import Bank Transactions</h1>
      </div>

      {/* Step 1: Bank Account */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Step 1: Select Bank Account</CardTitle></CardHeader>
        <CardContent>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
            <SelectContent>
              {accountList.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} {a.bankName ? `(${a.bankName})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Step 2: CSV Content */}
      {bankAccountId && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Step 2: Paste CSV Data</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={8} placeholder="Paste your bank CSV data here..." value={csvContent} onChange={(e) => { setCsvContent(e.target.value); if (e.target.value) setStep(3); }} className="font-mono text-xs" />
          </CardContent>
        </Card>
      )}

      {/* Step 3: Column Mapping */}
      {csvContent && preview.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Step 3: Map Columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date Column</Label>
                <Select value={dateCol} onValueChange={setDateCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{i}: {h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description Column</Label>
                <Select value={descCol} onValueChange={setDescCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{i}: {h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount Column</Label>
                <Select value={amountCol} onValueChange={setAmountCol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>{i}: {h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead><tr>{headers.map((h, i) => <th key={i} className={`p-1 border text-left ${i === Number(dateCol) ? "bg-blue-50" : i === Number(descCol) ? "bg-green-50" : i === Number(amountCol) ? "bg-amber-50" : ""}`}>{h}</th>)}</tr></thead>
                <tbody>{preview.slice(1, 6).map((row, ri) => <tr key={ri}>{row.map((c, ci) => <td key={ci} className={`p-1 border ${ci === Number(dateCol) ? "bg-blue-50" : ci === Number(descCol) ? "bg-green-50" : ci === Number(amountCol) ? "bg-amber-50" : ""}`}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Import */}
      {csvContent && preview.length > 1 && (
        <div className="flex gap-3">
          <Button disabled={!bankAccountId || parseMut.isLoading} onClick={() => {
            parseMut.mutate({
              bankAccountId,
              csvContent,
              mapping: { dateColumn: Number(dateCol), descriptionColumn: Number(descCol), amountColumn: Number(amountCol) },
            });
          }}>
            <Upload className="h-4 w-4 mr-2" /> {parseMut.isLoading ? "Importing..." : `Import ${preview.length - 1} Transactions`}
          </Button>
          {parseMut.isSuccess && (
            <Button variant="outline" onClick={() => router.push(`/accounting/reconcile/${bankAccountId}`)}>
              <CheckCircle className="h-4 w-4 mr-2" /> Start Reconciliation
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
