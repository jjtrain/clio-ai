"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", POSTED: "bg-green-100 text-green-700", VOIDED: "bg-red-100 text-red-700" };
const SOURCE_COLORS: Record<string, string> = {
  MANUAL: "bg-slate-100 text-slate-700", INVOICE: "bg-blue-100 text-blue-700", PAYMENT: "bg-green-100 text-green-700",
  TRUST: "bg-purple-100 text-purple-700", EXPENSE: "bg-amber-100 text-amber-700", TIME: "bg-teal-100 text-teal-700",
  ADJUSTMENT: "bg-orange-100 text-orange-700", OPENING_BALANCE: "bg-indigo-100 text-indigo-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function JournalEntriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const { data: entries } = trpc.accounting.listEntries.useQuery({
    status: statusFilter ? statusFilter as any : undefined,
    source: sourceFilter ? sourceFilter as any : undefined,
  });

  const postMut = trpc.accounting.postEntry.useMutation({
    onSuccess: () => { utils.accounting.listEntries.invalidate(); toast({ title: "Entry posted" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        <Button onClick={() => router.push("/accounting/journal/new")}><Plus className="h-4 w-4 mr-2" /> New Entry</Button>
      </div>

      <div className="flex gap-2">
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem><SelectItem value="DRAFT">Draft</SelectItem><SelectItem value="POSTED">Posted</SelectItem><SelectItem value="VOIDED">Voided</SelectItem></SelectContent>
        </Select>
        <Select value={sourceFilter || "__all__"} onValueChange={(v) => setSourceFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All sources" /></SelectTrigger>
          <SelectContent><SelectItem value="__all__">All</SelectItem>{["MANUAL","INVOICE","PAYMENT","TRUST","EXPENSE"].map((s) => <SelectItem key={s} value={s}>{fmt(s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Debits</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entries || []).map((entry: any) => {
                  const totalDebit = entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
                  const totalCredit = entry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{entry.description}</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[entry.source] || ""}`}>{fmt(entry.source)}</span></TableCell>
                      <TableCell className="text-right font-mono">{cur(totalDebit)}</TableCell>
                      <TableCell className="text-right font-mono">{cur(totalCredit)}</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status]}`}>{entry.status}</span></TableCell>
                      <TableCell>
                        {entry.status === "DRAFT" && (
                          <Button variant="ghost" size="sm" onClick={() => postMut.mutate({ id: entry.id })}>Post</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!entries?.length && <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">No journal entries</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
