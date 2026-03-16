"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: accounts } = trpc.accounting.listAccounts.useQuery();
  const createMut = trpc.accounting.createEntry.useMutation({
    onSuccess: () => { toast({ title: "Journal entry created" }); router.push("/accounting/journal"); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);

  const addLine = () => setLines([...lines, { accountId: "", debit: "", credit: "", description: "" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, j) => j !== i));
  const updateLine = (i: number, field: string, value: string) => {
    const newLines = [...lines];
    (newLines[i] as any)[field] = value;
    setLines(newLines);
  };

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = Math.abs(difference) < 0.01;

  const accountList = (accounts || []).sort((a: any, b: any) => a.accountNumber.localeCompare(b.accountNumber));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounting/journal"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">New Journal Entry</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description *</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description of this entry" /></div>
          </div>
          <div className="space-y-2"><Label>Memo</Label><Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lines</CardTitle>
            <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
              <div className="col-span-4">Account</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-1"></div>
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Select value={line.accountId} onValueChange={(v) => updateLine(i, "accountId", v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accountList.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.accountNumber} — {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3"><Input className="text-sm" placeholder="Description" value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} /></div>
                <div className="col-span-2"><Input className="text-sm text-right" type="number" step="0.01" placeholder="0.00" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} /></div>
                <div className="col-span-2"><Input className="text-sm text-right" type="number" step="0.01" placeholder="0.00" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} /></div>
                <div className="col-span-1">
                  {lines.length > 2 && <Button variant="ghost" size="sm" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-12 gap-2 pt-2 border-t font-medium">
              <div className="col-span-7 text-right">Totals:</div>
              <div className="col-span-2 text-right font-mono">{cur(totalDebit)}</div>
              <div className="col-span-2 text-right font-mono">{cur(totalCredit)}</div>
              <div className="col-span-1"></div>
            </div>
            <div className={`text-center font-bold text-sm ${isBalanced ? "text-green-600" : "text-red-600"}`}>
              {isBalanced ? "Balanced" : `Out of balance by ${cur(Math.abs(difference))}`}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" disabled={!isBalanced || !description || createMut.isLoading} onClick={() => {
          createMut.mutate({
            date, description, memo: memo || undefined, source: "MANUAL", status: "DRAFT",
            lines: lines.filter((l) => l.accountId).map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined })),
          });
        }}>
          Save as Draft
        </Button>
        <Button disabled={!isBalanced || !description || createMut.isLoading} onClick={() => {
          createMut.mutate({
            date, description, memo: memo || undefined, source: "MANUAL", status: "POSTED",
            lines: lines.filter((l) => l.accountId).map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined })),
          });
        }}>
          {createMut.isLoading ? "Saving..." : "Post Entry"}
        </Button>
      </div>
    </div>
  );
}
