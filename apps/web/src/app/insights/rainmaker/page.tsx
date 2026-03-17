"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, Plus, Lightbulb, ShieldAlert, Search, CheckCircle, AlertTriangle,
  AlertCircle, Info, ArrowRight, ExternalLink, FileText,
} from "lucide-react";

const DIAG_TYPES = [
  { value: "CLIENT_ONBOARDING", label: "Client Onboarding" },
  { value: "ANNUAL_REVIEW", label: "Annual Review" },
  { value: "RISK_ASSESSMENT", label: "Risk Assessment" },
  { value: "OPPORTUNITY_SCAN", label: "Opportunity Scan" },
  { value: "COMPLIANCE_CHECK", label: "Compliance Check" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700", IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700", REVIEWED: "bg-gray-100 text-gray-700",
};

function ScoreGauge({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full border-4 ${color}`}>
        <span className="text-xl font-bold">{score}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function RainmakerPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [showRun, setShowRun] = useState(false);
  const [selectedDiag, setSelectedDiag] = useState<string | null>(null);
  const [form, setForm] = useState({ clientId: "", diagnosticType: "CLIENT_ONBOARDING", context: "" });

  const { data: config } = trpc.finInsights["settings.get"].useQuery({ provider: "RAINMAKER" });
  const { data: diagnostics, isLoading } = trpc.finInsights["rainmaker.getDiagnostics"].useQuery();
  const { data: clients } = trpc.clients.list.useQuery({});
  const { data: pipeline } = trpc.finInsights["rainmaker.getOpportunityPipeline"].useQuery(undefined, { enabled: !!config?.isEnabled });

  const runMut = trpc.finInsights["rainmaker.runDiagnostic"].useMutation({
    onSuccess: () => { utils.finInsights["rainmaker.getDiagnostics"].invalidate(); setShowRun(false); toast({ title: "Diagnostic started" }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!config?.isEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Rainmaker Diagnostics</h1>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 text-amber-400" />
            <p className="text-amber-700 font-medium">Rainmaker is not connected.</p>
            <p className="text-sm text-amber-600 mt-1">Configure Rainmaker in Settings → Integrations to enable client diagnostics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedDiagData = diagnostics?.find((d: any) => d.id === selectedDiag);
  const findings = selectedDiagData?.findings ? JSON.parse(selectedDiagData.findings) : [];
  const opportunities = selectedDiagData?.opportunities ? JSON.parse(selectedDiagData.opportunities) : [];
  const workPlan = selectedDiagData?.workPlan ? JSON.parse(selectedDiagData.workPlan) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rainmaker Diagnostics</h1>
          <p className="text-sm text-slate-500">Client risk and opportunity analysis</p>
        </div>
        <Button onClick={() => setShowRun(true)}><Plus className="h-4 w-4 mr-2" />Run Diagnostic</Button>
      </div>

      {/* Diagnostics List */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Diagnostics</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium text-gray-500">Client</th>
                  <th className="pb-2 font-medium text-gray-500">Type</th>
                  <th className="pb-2 font-medium text-gray-500">Risk</th>
                  <th className="pb-2 font-medium text-gray-500">Opportunity</th>
                  <th className="pb-2 font-medium text-gray-500">Status</th>
                  <th className="pb-2 font-medium text-gray-500">Date</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {(diagnostics || []).map((diag: any) => {
                  const client = (clients as any)?.find((c: any) => c.id === diag.clientId);
                  return (
                    <tr key={diag.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDiag(diag.id)}>
                      <td className="py-3 font-medium">{client?.name || diag.clientId || "Firm-wide"}</td>
                      <td className="py-3">{diag.diagnosticType.replace(/_/g, " ")}</td>
                      <td className="py-3">{diag.riskScore != null ? <span className={`font-medium ${diag.riskScore > 70 ? "text-red-600" : diag.riskScore > 40 ? "text-amber-600" : "text-emerald-600"}`}>{diag.riskScore}</span> : "-"}</td>
                      <td className="py-3">{diag.opportunityScore != null ? <span className="font-medium text-blue-600">{diag.opportunityScore}</span> : "-"}</td>
                      <td className="py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[diag.status]}`}>{diag.status}</span></td>
                      <td className="py-3 text-gray-500">{new Date(diag.createdAt).toLocaleDateString()}</td>
                      <td className="py-3"><ArrowRight className="h-4 w-4 text-gray-300" /></td>
                    </tr>
                  );
                })}
                {(!diagnostics || diagnostics.length === 0) && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">No diagnostics run yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Diagnostic Detail */}
      {selectedDiagData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Diagnostic Detail</CardTitle>
            <CardDescription>{selectedDiagData.diagnosticType.replace(/_/g, " ")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scores */}
            <div className="flex gap-8 justify-center">
              {selectedDiagData.riskScore != null && <ScoreGauge label="Risk Score" score={selectedDiagData.riskScore} color={selectedDiagData.riskScore > 70 ? "border-red-400" : selectedDiagData.riskScore > 40 ? "border-amber-400" : "border-emerald-400"} />}
              {selectedDiagData.opportunityScore != null && <ScoreGauge label="Opportunity Score" score={selectedDiagData.opportunityScore} color="border-blue-400" />}
            </div>

            {/* Findings */}
            {findings.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Findings ({findings.length})</h3>
                <div className="space-y-2">
                  {findings.map((f: any, i: number) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-2">
                        {f.severity === "critical" ? <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" /> : f.severity === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" /> : <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
                        <div>
                          <p className="text-sm font-medium">{f.area}: {f.finding}</p>
                          {f.recommendation && <p className="text-xs text-gray-500 mt-1">{f.recommendation}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opportunities */}
            {opportunities.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Opportunities ({opportunities.length})</h3>
                <div className="space-y-2">
                  {opportunities.map((o: any, i: number) => (
                    <div key={i} className="p-3 border rounded-lg flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{o.area}: {o.description}</p>
                        <div className="flex gap-3 mt-1">
                          {o.estimatedValue && <span className="text-xs text-emerald-600">Est. ${Number(o.estimatedValue).toLocaleString()}</span>}
                          {o.effort && <span className="text-xs text-gray-500">Effort: {o.effort}</span>}
                          {o.timeframe && <span className="text-xs text-gray-500">{o.timeframe}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work Plan */}
            {workPlan.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Work Plan</h3>
                <div className="space-y-1">
                  {workPlan.map((task: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                      <CheckCircle className={`h-4 w-4 ${task.status === "completed" ? "text-emerald-500" : "text-gray-300"}`} />
                      <span className={`text-sm flex-1 ${task.status === "completed" ? "line-through text-gray-400" : ""}`}>{task.task}</span>
                      {task.assignedTo && <span className="text-xs text-gray-500">{task.assignedTo}</span>}
                      {task.deadline && <span className="text-xs text-gray-400">{task.deadline}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {selectedDiagData.aiAnalysis && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium mb-2">AI Analysis</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedDiagData.aiAnalysis}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Opportunity Pipeline */}
      {pipeline?.success && pipeline.data && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Opportunity Pipeline</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Opportunities identified across all clients, sorted by estimated value.</p>
            {/* Pipeline data display */}
            <pre className="text-xs bg-gray-50 p-3 rounded mt-3 overflow-auto max-h-60">{JSON.stringify(pipeline.data, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {/* Run Diagnostic Dialog */}
      <Dialog open={showRun} onOpenChange={setShowRun}>
        <DialogContent>
          <DialogHeader><DialogTitle>Run Diagnostic</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {((clients as any) || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Diagnostic Type</Label>
              <Select value={form.diagnosticType} onValueChange={(v) => setForm({ ...form, diagnosticType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIAG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Additional Context (optional)</Label>
              <Textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Any additional context about the client or specific areas to focus on..." />
            </div>
            <Button className="w-full" disabled={!form.clientId || runMut.isLoading} onClick={() => runMut.mutate({ clientId: form.clientId, diagnosticType: form.diagnosticType, additionalContext: form.context || undefined })}>
              {runMut.isLoading ? "Starting..." : "Run Diagnostic"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
