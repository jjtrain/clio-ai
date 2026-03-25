"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Heart, HeartPulse, Shield, Landmark, Building2, Globe, Home, Scale, ArrowRight, ArrowLeft, Check, Loader2, Sparkles, FileText, DollarSign, Plug, CheckSquare, Rocket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const ICONS: Record<string, any> = { Heart, HeartPulse, Shield, Landmark, Building2, Globe, Home, Scale };
const STEP_LABELS = ["Practice Areas", "Seeding", "Matter Templates", "Intake Forms", "Documents", "Billing", "Integrations", "Workflows", "Done"];

export default function OnboardingPage() {
  const sessionQuery = trpc.onboarding.getSession.useQuery();
  const areasQuery = trpc.onboarding.getPracticeAreas.useQuery();
  const selectMut = trpc.onboarding.selectAreas.useMutation({ onSuccess: () => { sessionQuery.refetch(); seedMut.mutate(); } });
  const seedMut = trpc.onboarding.seed.useMutation({ onSuccess: () => sessionQuery.refetch() });
  const advanceMut = trpc.onboarding.advanceStep.useMutation({ onSuccess: () => sessionQuery.refetch() });
  const completeMut = trpc.onboarding.complete.useMutation({ onSuccess: () => sessionQuery.refetch() });
  const skipMut = trpc.onboarding.skip.useMutation({ onSuccess: () => sessionQuery.refetch() });

  const [selected, setSelected] = useState<string[]>([]);
  const session = sessionQuery.data;
  const areas = areasQuery.data || [];
  const step = session?.currentStep || 0;

  // Load selected areas from session
  useEffect(() => { if (session?.selectedAreas) setSelected(session.selectedAreas as string[]); }, [session?.selectedAreas]);

  // Get configs for selected areas
  const selectedConfigs = areas.filter((a) => selected.includes(a.id));

  // Area-specific preview data queries
  const previewQuery = trpc.onboarding.getAreaConfig.useQuery({ area: selected[0] || "" }, { enabled: selected.length > 0 && step >= 2 });
  const config = previewQuery.data;

  function toggleArea(id: string) { setSelected((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]); }
  function goTo(s: number) { advanceMut.mutate({ step: s }); }

  if (session?.isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <Card className="p-12 text-center max-w-md">
          <Rocket className="h-16 w-16 text-indigo-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">You're all set!</h1>
          <p className="text-muted-foreground mt-2">Your workspace is configured for {(session.selectedAreas as string[])?.length || 0} practice area(s).</p>
          <a href="/matters"><Button className="mt-6 gap-2"><Sparkles className="h-4 w-4" /> Create Your First Matter</Button></a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Progress */}
        <div className="flex gap-1">{STEP_LABELS.map((_, i) => <div key={i} className={cn("flex-1 h-1.5 rounded-full", i <= step ? "bg-indigo-600" : "bg-gray-200")} />)}</div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}</p>
          {step > 0 && step < 8 && <button onClick={() => skipMut.mutate()} className="text-xs text-muted-foreground underline">Skip setup</button>}
        </div>

        {/* Step 0 — Practice Area Selection */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="text-center"><Sparkles className="h-10 w-10 text-indigo-500 mx-auto mb-3" /><h1 className="text-2xl font-bold">Welcome to Managal</h1><p className="text-muted-foreground mt-1">Select your practice area(s) and we'll set up your workspace</p></div>
            <div className="grid grid-cols-2 gap-3">
              {areas.map((area) => {
                const Icon = ICONS[area.icon] || Scale;
                const isSel = selected.includes(area.id);
                return (
                  <Card key={area.id} className={cn("p-4 cursor-pointer border-2 transition", isSel ? "border-indigo-500 bg-indigo-50" : "border-transparent hover:border-gray-300")} onClick={() => toggleArea(area.id)}>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isSel ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500")}><Icon className="h-5 w-5" /></div>
                      <div><h3 className="text-sm font-semibold">{area.name}</h3><p className="text-[11px] text-muted-foreground">{area.description}</p></div>
                    </div>
                    {isSel && <div className="absolute top-2 right-2"><Check className="h-4 w-4 text-indigo-600" /></div>}
                  </Card>
                );
              })}
            </div>
            <Button onClick={() => selectMut.mutate({ areas: selected })} disabled={selected.length === 0 || selectMut.isLoading} className="w-full gap-2">
              {selectMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Set Up My Workspace ({selected.length} area{selected.length !== 1 ? "s" : ""})
            </Button>
          </div>
        )}

        {/* Step 1 — Seeding */}
        {step === 1 && (
          <div className="text-center space-y-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto" />
            <h2 className="text-xl font-bold">Setting up your workspace...</h2>
            <p className="text-muted-foreground">Creating templates, forms, and workflows for your practice areas</p>
            <div className="h-3 bg-gray-100 rounded-full max-w-md mx-auto overflow-hidden"><div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${session?.seedingProgress || 0}%` }} /></div>
            {session?.seedingStatus === "COMPLETE" && (
              <Button onClick={() => goTo(2)} className="gap-2"><Check className="h-4 w-4" /> Continue</Button>
            )}
          </div>
        )}

        {/* Step 2 — Matter Templates */}
        {step === 2 && config && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-600" /> Matter Templates</h2>
            <p className="text-sm text-muted-foreground">We've created these matter types for you. You can customize them anytime.</p>
            <div className="grid grid-cols-2 gap-3">{config.matterTemplates.map((t, i) => (
              <Card key={i} className="p-4"><h3 className="text-sm font-semibold">{t.name}</h3><p className="text-xs text-muted-foreground mt-1">{t.description}</p></Card>
            ))}</div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => goTo(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button><Button onClick={() => goTo(3)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {/* Step 3 — Intake Forms */}
        {step === 3 && config && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-green-600" /> Client Intake Fields</h2>
            <p className="text-sm text-muted-foreground">Custom fields for your practice area intake forms.</p>
            <Card className="p-4 space-y-2">{config.customFields.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div><span className="text-sm font-medium">{f.name}</span>{f.required && <Badge className="text-[9px] bg-red-100 text-red-700 ml-2">Required</Badge>}</div>
                <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
              </div>
            ))}</Card>
            <div className="flex gap-2"><Button variant="outline" onClick={() => goTo(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button><Button onClick={() => goTo(4)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {/* Step 4 — Document Templates */}
        {step === 4 && config && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> Document Templates</h2>
            <p className="text-sm text-muted-foreground">Starter templates ready for customization.</p>
            <div className="space-y-2">{config.docTemplates.map((t, i) => (
              <Card key={i} className="p-3 flex items-center justify-between">
                <div><span className="text-sm font-medium">{t.name}</span><p className="text-xs text-muted-foreground">{t.description}</p></div>
                <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
              </Card>
            ))}</div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => goTo(3)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button><Button onClick={() => goTo(5)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {/* Step 5 — Billing */}
        {step === 5 && config && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" /> Billing Setup</h2>
            <Card className="p-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee Type</span><span className="font-semibold capitalize">{config.billing.feeType}</span></div>
              {config.billing.feeType === "hourly" && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Hourly Range</span><span className="font-mono">${config.billing.hourlyRateRange[0]} – ${config.billing.hourlyRateRange[1]}</span></div>}
              {config.billing.contingencyPct && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Contingency</span><span className="font-mono">{config.billing.contingencyPct}%</span></div>}
              {config.billing.flatFees.length > 0 && <div><p className="text-xs text-muted-foreground mb-1">Flat Fees</p>{config.billing.flatFees.map((f, i) => <div key={i} className="flex justify-between text-sm py-0.5"><span>{f.name}</span><span className="font-mono">${f.amount.toLocaleString()}</span></div>)}</div>}
              <div><p className="text-xs text-muted-foreground mb-1">Billing Codes</p>{config.billing.billingCodes.map((c, i) => <Badge key={i} variant="outline" className="text-[10px] mr-1">{c.code}: {c.description}</Badge>)}</div>
            </Card>
            <div className="flex gap-2"><Button variant="outline" onClick={() => goTo(4)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button><Button onClick={() => goTo(6)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {/* Step 6 — Integrations */}
        {step === 6 && config && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Plug className="h-5 w-5 text-purple-600" /> Recommended Integrations</h2>
            <div className="space-y-2">{config.integrations.map((ig, i) => (
              <Card key={i} className="p-3 flex items-center justify-between">
                <div><span className="text-sm font-medium">{ig.name}</span><p className="text-xs text-muted-foreground">{ig.description}</p></div>
                <Badge variant="outline" className="text-[10px]">{ig.category}</Badge>
              </Card>
            ))}</div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => goTo(5)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button><Button onClick={() => goTo(7)}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button></div>
          </div>
        )}

        {/* Step 7 — Workflows */}
        {step === 7 && config && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><CheckSquare className="h-5 w-5 text-amber-600" /> Sample Workflow</h2>
            <p className="text-sm text-muted-foreground">A typical task sequence for your practice area.</p>
            {config.workflows.map((wf, wi) => (
              <Card key={wi} className="p-4">
                <h3 className="text-sm font-semibold mb-3">{wf.name}</h3>
                <div className="relative pl-6 space-y-3">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
                  {wf.tasks.map((t, ti) => (
                    <div key={ti} className="relative"><div className="absolute -left-6 w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-400 flex items-center justify-center text-[8px] font-bold text-indigo-600">{ti + 1}</div>
                      <div><span className="text-sm font-medium">{t.title}</span><span className="text-[10px] text-muted-foreground ml-2">Day {t.dueDaysFromOpen}</span><p className="text-xs text-muted-foreground">{t.description}</p></div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <div className="flex gap-2"><Button variant="outline" onClick={() => goTo(6)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button><Button onClick={() => completeMut.mutate()} disabled={completeMut.isLoading} className="gap-2">
              {completeMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Complete Setup
            </Button></div>
          </div>
        )}

        {/* Step 8 — Done */}
        {step === 8 && (
          <div className="text-center py-12 space-y-4">
            <Rocket className="h-16 w-16 text-indigo-500 mx-auto" />
            <h1 className="text-2xl font-bold">Your workspace is ready!</h1>
            <p className="text-muted-foreground">We've configured {selected.length} practice area(s) with templates, forms, billing defaults, and workflows.</p>
            <a href="/matters"><Button className="gap-2" size="lg"><Sparkles className="h-5 w-5" /> Create Your First Matter</Button></a>
          </div>
        )}
      </div>
    </div>
  );
}
