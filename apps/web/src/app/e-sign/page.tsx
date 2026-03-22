"use client";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PenTool, Plus, Clock, CheckCircle2, TrendingUp, Percent, Send, Eye, XCircle, Download, Database } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusCfg: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  SENT: { label: "Sent", color: "bg-blue-100 text-blue-700" },
  VIEWED: { label: "Viewed", color: "bg-amber-100 text-amber-700" },
  PARTIALLY_SIGNED: { label: "Partial", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700" },
  EXPIRED: { label: "Expired", color: "bg-red-100 text-red-700" },
  DECLINED: { label: "Declined", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-600" },
};

export default function ESignDashboard() {
  const { data, isLoading } = trpc.mobileSign["list"].useQuery({});
  const seed = trpc.mobileSign.templates.seed.useMutation();
  const requests = ((data ?? []) as any[]);
  const pending = requests.filter((r: any) => ["SENT", "VIEWED", "PARTIALLY_SIGNED"].includes(r.status));
  const completed = requests.filter((r: any) => r.status === "COMPLETED");
  const now = new Date();
  const monthCompleted = completed.filter((r: any) => {
    const d = new Date(r.completedAt || r.updatedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const avgHrs = completed.length ? Math.round(completed.reduce((s: number, r: any) =>
    s + (new Date(r.completedAt || r.updatedAt).getTime() - new Date(r.sentAt).getTime()) / 3.6e6, 0) / completed.length) : 0;
  const rate = requests.length ? Math.round((completed.length / requests.length) * 100) : 0;
  const stats = [
    { label: "Pending", value: pending.length, icon: Clock, color: "text-amber-600" },
    { label: "Completed (Month)", value: monthCompleted.length, icon: CheckCircle2, color: "text-green-600" },
    { label: "Avg Time (hrs)", value: avgHrs || "--", icon: TrendingUp, color: "text-blue-600" },
    { label: "Completion Rate", value: `${rate}%`, icon: Percent, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">E-Signatures</h1>
          <p className="text-muted-foreground">Send, track, and manage document signatures</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Database className="mr-2 h-4 w-4" />{seed.isPending ? "Seeding..." : "Seed Templates"}
          </Button>
          <Button asChild><Link href="/e-sign/new"><Plus className="mr-2 h-4 w-4" />Create Signature Request</Link></Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
            <s.icon className={`h-8 w-8 ${s.color} opacity-70`} />
          </div></CardContent></Card>
        ))}
      </div>
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold">Pending Requests</h2></div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Signer(s)</TableHead>
            <TableHead>Sent</TableHead><TableHead>Status</TableHead><TableHead className="w-[140px]">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : pending.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">
                <PenTool className="h-8 w-8 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No pending requests</p>
              </TableCell></TableRow>
            ) : pending.map((r: any) => {
              const c = statusCfg[r.status] || statusCfg.DRAFT;
              return (<TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell><Badge variant="outline">{r.templateType || "Custom"}</Badge></TableCell>
                <TableCell className="text-sm">{r.signers?.map((s: any) => s.name).join(", ") || r.signerName}</TableCell>
                <TableCell className="text-sm text-gray-500">{r.sentAt ? formatDate(r.sentAt) : "--"}</TableCell>
                <TableCell><span className={`text-xs font-medium px-2 py-1 rounded-full ${c.color}`}>{c.label}</span></TableCell>
                <TableCell><div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="Remind"><Send className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Cancel"><XCircle className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" asChild title="View"><Link href={`/e-sign/${r.id}`}><Eye className="h-4 w-4" /></Link></Button>
                </div></TableCell>
              </TableRow>);
            })}
          </TableBody>
        </Table>
      </div>
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold">Recently Completed</h2></div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Title</TableHead><TableHead>Signer(s)</TableHead><TableHead>Completed</TableHead><TableHead className="w-[80px]">Download</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {completed.slice(0, 10).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="text-sm">{r.signers?.map((s: any) => s.name).join(", ") || r.signerName}</TableCell>
                <TableCell className="text-sm text-gray-500">{formatDate(r.completedAt || r.updatedAt)}</TableCell>
                <TableCell><Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {completed.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-500">No completed requests yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
