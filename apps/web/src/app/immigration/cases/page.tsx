"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Plus, Search, Eye } from "lucide-react";

const caseTypes = ["All", "H-1B", "L-1", "O-1", "EB-1", "EB-2", "EB-3", "PERM", "I-485", "I-130", "N-400"];
const statuses = ["All", "ACTIVE", "PENDING", "APPROVED", "DENIED", "RFE", "WITHDRAWN"];

export default function CasesPage() {
  const [caseType, setCaseType] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");

  const { data: cases } = trpc.immigration["cases.list"].useQuery({
    caseType: caseType !== "All" ? caseType : undefined,
    status: status !== "All" ? status : undefined,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Immigration Cases</h1>
        <Link href="/immigration/cases/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New Case</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search beneficiary or receipt #..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={caseType} onValueChange={setCaseType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Case Type" /></SelectTrigger>
            <SelectContent>{caseTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Beneficiary</TableHead>
              <TableHead>Case Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Receipt #</TableHead>
              <TableHead>Priority Date</TableHead>
              <TableHead>RFE</TableHead>
              <TableHead>Next Deadline</TableHead>
              <TableHead>Matter</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="text-sm">{c.createdAt}</TableCell>
                <TableCell className="font-medium">{c.beneficiaryName}</TableCell>
                <TableCell><Badge variant="outline">{c.caseType}</Badge></TableCell>
                <TableCell>
                  <Badge variant={c.status === "APPROVED" ? "default" : c.status === "RFE" ? "destructive" : "secondary"}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{c.receiptNumber ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.priorityDate ?? "—"}</TableCell>
                <TableCell>
                  {c.hasRFE && <Badge variant="destructive">RFE</Badge>}
                </TableCell>
                <TableCell className="text-sm">{c.nextDeadline ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.matterName}</TableCell>
                <TableCell>
                  <Link href={`/immigration/cases/${c.id}`}>
                    <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
