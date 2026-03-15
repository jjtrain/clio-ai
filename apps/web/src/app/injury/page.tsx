"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  HeartPulse,
  DollarSign,
  FileText,
  Clock,
  Plus,
  Link as LinkIcon,
} from "lucide-react";

const CASE_STATUS_COLORS: Record<string, string> = {
  PRE_SUIT: "bg-blue-100 text-blue-700",
  TREATMENT: "bg-purple-100 text-purple-700",
  MAX_MEDICAL_IMPROVEMENT: "bg-amber-100 text-amber-700",
  DEMAND_SENT: "bg-orange-100 text-orange-700",
  NEGOTIATION: "bg-teal-100 text-teal-700",
  LITIGATION: "bg-red-100 text-red-700",
  MEDIATION: "bg-indigo-100 text-indigo-700",
  TRIAL: "bg-red-100 text-red-700",
  SETTLED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-700",
};

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  AUTO_ACCIDENT: "bg-blue-100 text-blue-700",
  SLIP_FALL: "bg-amber-100 text-amber-700",
  MEDICAL_MALPRACTICE: "bg-red-100 text-red-700",
  PRODUCT_LIABILITY: "bg-purple-100 text-purple-700",
  WORK_INJURY: "bg-orange-100 text-orange-700",
  DOG_BITE: "bg-pink-100 text-pink-700",
  ASSAULT: "bg-red-100 text-red-700",
  PREMISES_LIABILITY: "bg-teal-100 text-teal-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const INCIDENT_TYPES = [
  "AUTO_ACCIDENT", "SLIP_FALL", "MEDICAL_MALPRACTICE", "PRODUCT_LIABILITY",
  "WORK_INJURY", "DOG_BITE", "ASSAULT", "PREMISES_LIABILITY", "OTHER",
];

function formatCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InjuryDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [dateOfIncident, setDateOfIncident] = useState("");
  const [incidentType, setIncidentType] = useState("AUTO_ACCIDENT");

  const { data: cases, isLoading: casesLoading } = trpc.medicalRecords.listCases.useQuery();
  const { data: stats } = trpc.medicalRecords.getDashboardStats.useQuery();
  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });

  const utils = trpc.useUtils();
  const createCase = trpc.medicalRecords.createCaseDetails.useMutation({
    onSuccess: (data) => {
      toast({ title: "PI case linked" });
      utils.medicalRecords.listCases.invalidate();
      utils.medicalRecords.getDashboardStats.invalidate();
      setLinkDialogOpen(false);
      router.push(`/injury/${data.matterId}`);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const existingMatterIds = new Set((cases || []).map((c: any) => c.matterId));
  const availableMatters = (mattersData?.matters || []).filter((m: any) => !existingMatterIds.has(m.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Personal Injury Management</h1>
          <p className="text-sm text-slate-500">Manage medical records, liens, and settlements</p>
        </div>
        <Button onClick={() => setLinkDialogOpen(true)}>
          <LinkIcon className="h-4 w-4 mr-2" />
          Link Matter
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <HeartPulse className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Active PI Cases</p>
                <p className="text-2xl font-bold">{stats?.activeCases ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Medical Specials</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalSpecials)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <FileText className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Lien Exposure</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalLiens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending Record Requests</p>
                <p className="text-2xl font-bold">{stats?.pendingRequests ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {casesLoading ? (
            <p className="text-slate-500 py-4">Loading...</p>
          ) : !cases?.length ? (
            <p className="text-slate-500 py-4">No PI cases yet. Link a matter to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matter</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Incident Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date of Incident</TableHead>
                    <TableHead className="text-right">Total Specials</TableHead>
                    <TableHead className="text-right">Total Liens</TableHead>
                    <TableHead className="text-right">Demand</TableHead>
                    <TableHead className="text-right">Settlement</TableHead>
                    <TableHead className="text-right">Policy Limits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((c: any) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/injury/${c.matterId}`)}
                    >
                      <TableCell className="font-medium">{c.matter?.name}</TableCell>
                      <TableCell>{c.matter?.client?.name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INCIDENT_TYPE_COLORS[c.incidentType] || "bg-gray-100 text-gray-700"}`}>
                          {formatLabel(c.incidentType)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CASE_STATUS_COLORS[c.caseStatus] || "bg-gray-100 text-gray-700"}`}>
                          {formatLabel(c.caseStatus)}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(c.dateOfIncident).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.totalMedicalSpecials)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.totalLienAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.demandAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.settlementAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.policyLimits)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Matter Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Matter as PI Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Matter</Label>
              <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a matter" />
                </SelectTrigger>
                <SelectContent>
                  {availableMatters.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} — {m.client?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date of Incident</Label>
              <Input type="date" value={dateOfIncident} onChange={(e) => setDateOfIncident(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Incident Type</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={!selectedMatterId || !dateOfIncident || createCase.isLoading}
                onClick={() => {
                  createCase.mutate({
                    matterId: selectedMatterId,
                    dateOfIncident,
                    incidentType: incidentType as any,
                  });
                }}
              >
                {createCase.isLoading ? "Linking..." : "Link Matter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
