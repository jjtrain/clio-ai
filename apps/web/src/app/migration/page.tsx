"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, Upload, Check, X, Loader2, Download, AlertTriangle, CheckCircle, FileText, Users, Briefcase, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const STEPS = ["Source", "Authenticate", "Preview", "Field Mapping", "Options", "Import", "Summary"];
const PROVIDERS = [
  { id: "CLIO", name: "Clio", auth: "oauth", desc: "Import from Clio Manage", color: "bg-blue-500" },
  { id: "PRACTICEPANTHER", name: "PracticePanther", auth: "apikey", desc: "Import from PracticePanther", color: "bg-green-500" },
  { id: "MYCASE", name: "MyCase", auth: "oauth", desc: "Import from MyCase", color: "bg-purple-500" },
];
const TYPE_ICONS: Record<string, any> = { contacts: Users, matters: Briefcase, documents: FileText, billing: DollarSign };

export default function MigrationWizardPage() {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState("");
  const [token, setToken] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(["contacts", "matters", "documents", "billing"]);
  const [isDryRun, setIsDryRun] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  const createJobMut = trpc.migration.createJob.useMutation();
  const previewMut = trpc.migration.preview.useMutation({ onSuccess: (data) => setPreview(data) });
  const startJobMut = trpc.migration.startJob.useMutation();
  const cancelJobMut = trpc.migration.cancelJob.useMutation();
  const jobQuery = trpc.migration.getJob.useQuery({ jobId: jobId || "" }, { enabled: !!jobId, refetchInterval: jobId ? 2000 : false });
  const errorsCsvQuery = trpc.migration.getErrorsCsv.useQuery({ jobId: jobId || "" }, { enabled: !!jobId && step === 6 });

  const job = jobQuery.data;
  const isRunning = job?.status === "RUNNING";
  const isComplete = job?.status === "COMPLETED" || job?.status === "FAILED";

  function toggleType(t: string) { setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]); }

  async function handleStart() {
    const created = await createJobMut.mutateAsync({ provider, accessToken: token, selectedTypes, isDryRun });
    setJobId(created.id);
    await startJobMut.mutateAsync({ jobId: created.id });
    setStep(5);
  }

  function downloadErrors() {
    if (!errorsCsvQuery.data) return;
    const blob = new Blob([errorsCsvQuery.data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `migration-errors-${jobId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Progress bar */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Upload className="h-7 w-7 text-indigo-600" /> Migration Wizard</h1>
        <p className="text-sm text-muted-foreground mt-1">Import your data from another platform</p>
      </div>

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className={cn("flex-1 h-2 rounded-full", i <= step ? "bg-indigo-600" : "bg-gray-200")} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      {/* Step 0 — Source Selection */}
      {step === 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Select your current platform</h2>
          {PROVIDERS.map((p) => (
            <Card key={p.id} className={cn("p-4 cursor-pointer border-2 transition", provider === p.id ? "border-indigo-500 bg-indigo-50" : "border-transparent hover:border-gray-300")} onClick={() => setProvider(p.id)}>
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold", p.color)}>{p.name[0]}</div>
                <div><h3 className="text-sm font-semibold">{p.name}</h3><p className="text-xs text-muted-foreground">{p.desc}</p><Badge variant="outline" className="text-[9px] mt-1">{p.auth === "oauth" ? "OAuth 2.0" : "API Key"}</Badge></div>
              </div>
            </Card>
          ))}
          <Button onClick={() => setStep(1)} disabled={!provider} className="gap-1">Next <ArrowRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Step 1 — Authentication */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Authenticate with {PROVIDERS.find((p) => p.id === provider)?.name}</h2>
          {PROVIDERS.find((p) => p.id === provider)?.auth === "apikey" ? (
            <div><label className="text-sm text-muted-foreground">API Key</label><Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your API key" className="mt-1" /></div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-2">For demo purposes, paste an access token. In production, this would use OAuth redirect.</p>
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Access token" />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={() => { previewMut.mutate({ provider, accessToken: token }); setStep(2); }} disabled={!token}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Data Preview</h2>
          {previewMut.isLoading ? <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Fetching sample data...</div> : preview ? (
            <div className="grid grid-cols-2 gap-3">
              {(["contacts", "matters", "documents", "invoices"] as const).map((type) => {
                const data = preview[type];
                const Icon = TYPE_ICONS[type === "invoices" ? "billing" : type] || FileText;
                return (
                  <Card key={type} className="p-4">
                    <div className="flex items-center gap-2 mb-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold capitalize">{type}</span><Badge variant="outline" className="text-[10px]">{data?.count || 0} found</Badge></div>
                    {data?.sample?.slice(0, 2).map((s: any, i: number) => <p key={i} className="text-xs text-muted-foreground truncate">{s.firstName || s.name || s.id} {s.lastName || ""}</p>)}
                  </Card>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground">No preview data available — check your credentials</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={() => setStep(3)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step 3 — Field Mapping */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Field Mapping</h2>
          <p className="text-sm text-muted-foreground">Default mappings are applied. Customize if needed.</p>
          <Card className="p-4 space-y-2">
            {[["firstName", "firstName"], ["lastName", "lastName"], ["email", "email"], ["phone", "phone"], ["name", "name (matter)"], ["status", "status"], ["amount", "amount (invoice)"]].map(([src, dest]) => (
              <div key={src} className="flex items-center gap-3 text-sm"><span className="w-32 text-muted-foreground font-mono">{src}</span><ArrowRight className="h-3 w-3 text-muted-foreground" /><span className="font-mono font-medium">{dest}</span><Badge className="text-[9px] bg-green-100 text-green-700">Auto-mapped</Badge></div>
            ))}
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={() => setStep(4)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step 4 — Options */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Migration Options</h2>
          <div className="space-y-2">
            {["contacts", "matters", "documents", "billing"].map((type) => {
              const Icon = TYPE_ICONS[type] || FileText;
              return (
                <button key={type} onClick={() => toggleType(type)} className={cn("flex items-center gap-3 w-full p-3 rounded-lg border text-left", selectedTypes.includes(type) ? "border-indigo-300 bg-indigo-50" : "border-gray-200 opacity-60")}>
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center", selectedTypes.includes(type) ? "bg-indigo-600 border-indigo-600" : "border-gray-300")}>{selectedTypes.includes(type) && <Check className="h-3 w-3 text-white" />}</div>
                  <Icon className="h-4 w-4" /><span className="text-sm font-medium capitalize">{type}</span>
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isDryRun} onChange={(e) => setIsDryRun(e.target.checked)} /> Dry run (simulate only — don't write any data)</label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={handleStart} disabled={selectedTypes.length === 0 || createJobMut.isLoading}>
              {createJobMut.isLoading || startJobMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              {isDryRun ? "Start Dry Run" : "Start Import"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 5 — Progress */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{isDryRun ? "Dry Run" : "Importing"}...</h2>
          {job && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${job.progressPct}%` }} /></div>
                <span className="text-sm font-mono">{job.progressPct}%</span>
              </div>
              {job.currentType && <p className="text-sm text-muted-foreground">Processing: {job.currentType}</p>}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3"><p className="text-xs text-green-600">Imported</p><p className="text-xl font-bold text-green-700">{job.importedCount}</p></Card>
                <Card className="p-3"><p className="text-xs text-muted-foreground">Skipped</p><p className="text-xl font-bold">{job.skippedCount}</p></Card>
                <Card className="p-3"><p className="text-xs text-red-600">Failed</p><p className="text-xl font-bold text-red-700">{job.failedCount}</p></Card>
              </div>
              {/* Error log */}
              {(job.errorLog as any[])?.length > 0 && (
                <Card className="p-3 max-h-[200px] overflow-auto"><h3 className="text-xs font-semibold text-red-600 mb-1">Errors</h3>
                  {(job.errorLog as any[]).slice(-10).map((e: any, i: number) => (
                    <p key={i} className="text-xs text-red-700"><Badge variant="outline" className="text-[9px] mr-1">{e.entityType}</Badge>{e.sourceId}: {e.reason}</p>
                  ))}
                </Card>
              )}
              <div className="flex gap-2">
                {isRunning && <Button variant="outline" className="text-red-600" onClick={() => cancelJobMut.mutate({ jobId: job.id })}><X className="h-4 w-4 mr-1" /> Cancel</Button>}
                {isComplete && <Button onClick={() => setStep(6)}>View Summary <ArrowRight className="h-4 w-4 ml-1" /></Button>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 6 — Summary */}
      {step === 6 && job && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {job.status === "COMPLETED" ? <CheckCircle className="h-6 w-6 text-green-600" /> : <AlertTriangle className="h-6 w-6 text-red-600" />}
            <h2 className="text-lg font-semibold">{isDryRun ? "Dry Run" : "Migration"} {job.status === "COMPLETED" ? "Complete" : job.status}</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center"><p className="text-3xl font-bold text-green-700">{job.importedCount}</p><p className="text-xs text-muted-foreground">Imported</p></Card>
            <Card className="p-4 text-center"><p className="text-3xl font-bold">{job.skippedCount}</p><p className="text-xs text-muted-foreground">Skipped (duplicates)</p></Card>
            <Card className="p-4 text-center"><p className="text-3xl font-bold text-red-700">{job.failedCount}</p><p className="text-xs text-muted-foreground">Failed</p></Card>
          </div>
          {job.failedCount > 0 && (
            <Button variant="outline" onClick={downloadErrors}><Download className="h-4 w-4 mr-1" /> Download Error CSV</Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep(0); setJobId(null); setProvider(""); setToken(""); setPreview(null); }}>Start New Migration</Button>
          </div>
        </div>
      )}
    </div>
  );
}
