"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search } from "lucide-react";

const formStatuses = ["All", "NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FILED"];

export default function FormsPage() {
  const [caseId, setCaseId] = useState("All");
  const [formNumber, setFormNumber] = useState("");
  const [status, setStatus] = useState("All");

  const { data: cases } = trpc.immigration["cases.list"].useQuery({});
  const { data: forms } = trpc.immigration["forms.list"].useQuery(
    { caseId: caseId !== "All" ? caseId : "" },
    { enabled: caseId !== "All" && caseId !== "" }
  );

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <FileText className="h-8 w-8" /> Forms Center
      </h1>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search form number..." className="pl-9" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} />
          </div>
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Case" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Cases</SelectItem>
              {cases?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.beneficiaryName} - {c.caseType}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{formStatuses.map((s) => <SelectItem key={s} value={s}>{s === "All" ? "All" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Case</TableHead>
              <TableHead>Beneficiary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forms?.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono font-medium">{f.formNumber}</TableCell>
                <TableCell>{f.description}</TableCell>
                <TableCell><Badge variant="outline">{f.caseType}</Badge></TableCell>
                <TableCell>{f.beneficiaryName}</TableCell>
                <TableCell>
                  <Badge variant={f.status === "COMPLETED" || f.status === "FILED" ? "default" : "secondary"}>
                    {f.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{f.dueDate ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
