"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  User, FileText, FolderOpen, CalendarDays, AlertTriangle, Clock,
  CheckCircle, Circle, Users,
} from "lucide-react";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");

  const { data: caseData } = trpc.immigration["cases.get"].useQuery({ id });
  const { data: forms } = trpc.immigration["forms.list"].useQuery({ caseId: id });
  const { data: documents } = trpc.immigration["documents.list"].useQuery({ caseId: id });
  const { data: deadlines } = trpc.immigration["deadlines.list"].useQuery({ caseId: id });
  const rfe = caseData?.rfeDate ? { rfeDate: caseData.rfeDate, rfeDeadline: caseData.rfeDeadline, rfeDescription: caseData.rfeDescription } : null;
  const { data: timeline } = trpc.immigration["cases.getTimeline"].useQuery({ caseId: id });

  if (!caseData) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <User className="h-8 w-8" /> {caseData.beneficiaryName}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant="outline">{caseData.caseType}</Badge>
            <Badge variant={caseData.status === "APPROVED" ? "default" : caseData.status === "RFE_ISSUED" ? "destructive" : "secondary"}>
              {caseData.status}
            </Badge>
            {caseData.receiptNumber && (
              <span className="text-sm font-mono text-muted-foreground">{caseData.receiptNumber}</span>
            )}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="rfe">RFE</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Case Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Case Type</span><span>{caseData.caseType}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Priority Date</span><span>{caseData.priorityDate ? new Date(caseData.priorityDate).toLocaleDateString() : "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Filed Date</span><span>{caseData.filingDate ? new Date(caseData.filingDate).toLocaleDateString() : "Not filed"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Matter</span><span>{caseData.matter?.name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Petitioner</span><span>{caseData.petitionerName || "—"}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Dependents</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {caseData.dependents ? (JSON.parse(caseData.dependents) as any[]).map((d: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm border-b pb-1 last:border-0">
                    <span>{d.name}</span><Badge variant="outline">{d.relationship}</Badge>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No dependents</p>}
              </CardContent>
            </Card>
            {caseData.visaBulletinCategory && (
              <Card>
                <CardHeader><CardTitle>Visa Bulletin</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{caseData.visaBulletinCategory}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{caseData.visaBulletinCountry || "All"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Current</span><span>{caseData.isCurrent ? "Yes" : "No"}</span></div>
                </CardContent>
              </Card>
            )}
            {caseData.notes && (
              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap">{caseData.notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="forms">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms?.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono">{f.formNumber}</TableCell>
                    <TableCell>{f.description}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === "COMPLETED" ? "default" : "secondary"}>{f.status}</Badge>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {documents?.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    {d.collected ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm">{d.name}</span>
                  </div>
                  <Badge variant={d.collected ? "default" : "outline"}>{d.collected ? "Collected" : "Pending"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deadlines">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {deadlines?.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.dueDate}</p>
                    </div>
                  </div>
                  <Badge variant={d.status === "OVERDUE" ? "destructive" : d.status === "URGENT" ? "destructive" : "secondary"}>
                    {d.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rfe" className="space-y-4">
          {rfe ? (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> RFE Analysis</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span>{rfe.rfeDate ? new Date(rfe.rfeDate).toLocaleDateString() : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span className="font-bold text-destructive">{rfe.rfeDeadline ? new Date(rfe.rfeDeadline).toLocaleDateString() : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span>{rfe.rfeDescription || "—"}</span></div>
                  {rfe.rfeDescription && <p className="mt-2 border-t pt-2 whitespace-pre-wrap">{rfe.rfeDescription}</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Response</CardTitle></CardHeader>
                <CardContent>
                  <Badge variant={caseData?.rfeResponseDate ? "default" : "secondary"}>{caseData?.rfeResponseDate ? "Filed" : "Pending"}</Badge>
                  {caseData?.rfeResponseDate && <p className="mt-2 text-sm">Responded: {new Date(caseData.rfeResponseDate).toLocaleDateString()}</p>}
                </CardContent>
              </Card>
            </>
          ) : <p className="text-muted-foreground">No RFE for this case.</p>}
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {timeline?.map((t: any) => (
                <div key={t.id} className="flex gap-4 border-b pb-3 last:border-0">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.date} &mdash; {t.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
