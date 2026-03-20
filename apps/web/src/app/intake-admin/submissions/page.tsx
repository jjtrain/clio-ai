"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Download, Calendar } from "lucide-react";

const statuses = ["all", "new", "contacted", "converted", "rejected"];

function qualityColor(score: number) {
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-purple-100 text-purple-700",
    converted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export default function SubmissionsListPage() {
  const [status, setStatus] = useState("all");
  const [formFilter, setFormFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");

  const { data: forms } = trpc.intakeForms["forms.list"].useQuery();
  const { data: submissions } = trpc.intakeForms["submissions.list"].useQuery({
    status: status !== "all" ? status : undefined,
    formId: formFilter !== "all" ? formFilter : undefined,
    dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
  });

  const handleExport = () => {
    const csv = [
      ["Date", "Name", "Email", "Form", "Practice Area", "Quality Score", "Status"].join(","),
      ...(submissions ?? []).map((s: any) =>
        [new Date(s.createdAt).toLocaleDateString(), s.name, s.email, s.formName, s.practiceArea, s.qualityScore, s.status].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "submissions.csv";
    a.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Submissions</h1>
        <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-1" />Export</Button>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          {statuses.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">{s === "all" ? "All" : s}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input className="pl-9" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={formFilter} onValueChange={setFormFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Forms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                {forms?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <Input type="date" className="w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="text-gray-400">-</span>
              <Input type="date" className="w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <Input type="number" className="w-20" placeholder="Min" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
              <span className="text-gray-400">-</span>
              <Input type="number" className="w-20" placeholder="Max" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Practice Area</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!submissions?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-8">No submissions found.</TableCell></TableRow>
              ) : submissions.map((sub: any) => (
                <TableRow key={sub.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell><Link href={`/intake-admin/submissions/${sub.id}`} className="block">{new Date(sub.createdAt).toLocaleDateString()}</Link></TableCell>
                  <TableCell><Link href={`/intake-admin/submissions/${sub.id}`} className="font-medium">{sub.name ?? "Anonymous"}</Link></TableCell>
                  <TableCell className="text-sm text-gray-600">{sub.email}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{sub.formName}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{sub.practiceArea}</Badge></TableCell>
                  <TableCell><Badge className={qualityColor(sub.qualityScore)}>{sub.qualityScore}</Badge></TableCell>
                  <TableCell><Badge className={statusColor(sub.status)}>{sub.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
