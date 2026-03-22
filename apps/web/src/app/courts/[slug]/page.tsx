"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Phone, Clock, CreditCard, FileText, Users, Upload, ExternalLink, ChevronDown, CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";

const courtTypeBadge: Record<string, { label: string; className: string }> = {
  STATE_SUPREME: { label: "Supreme", className: "bg-blue-100 text-blue-800" },
  FEDERAL_DISTRICT: { label: "Federal District", className: "bg-purple-100 text-purple-800" },
  STATE_FAMILY: { label: "Family", className: "bg-pink-100 text-pink-800" },
  STATE_CRIMINAL: { label: "Criminal", className: "bg-red-100 text-red-800" },
  STATE_CIVIL: { label: "Civil", className: "bg-emerald-100 text-emerald-800" },
  STATE_APPELLATE: { label: "Appellate", className: "bg-amber-100 text-amber-800" },
};

const eFilingBadge: Record<string, { label: string; className: string }> = {
  NYSCEF: { label: "NYSCEF", className: "bg-green-100 text-green-800" },
  ECF_PACER: { label: "ECF/PACER", className: "bg-purple-100 text-purple-800" },
  NONE: { label: "No E-Filing", className: "bg-gray-100 text-gray-600" },
};

const severityConfig: Record<string, { label: string; className: string; icon: any }> = {
  RS_REQUIRED: { label: "Required", className: "bg-red-100 text-red-800", icon: XCircle },
  RS_RECOMMENDED: { label: "Recommended", className: "bg-amber-100 text-amber-800", icon: AlertTriangle },
  RS_INFORMATIONAL: { label: "Info", className: "bg-blue-100 text-blue-800", icon: Info },
  RS_WARNING: { label: "Warning", className: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
};

function RuleCard({ rule }: { rule: any }) {
  const sev = severityConfig[rule.severity] ?? severityConfig.RS_INFORMATIONAL!;
  const SevIcon = sev.icon;
  const [expanded, setExpanded] = useState(false);
  const desc = rule.description ?? "";
  const truncated = desc.length > 180 && !expanded;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <SevIcon className="h-4 w-4 shrink-0" />
          <h4 className="font-semibold text-gray-900 text-sm">{rule.title}</h4>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Badge className={sev.className} variant="secondary">{sev.label}</Badge>
          {rule.reminderTiming && <Badge variant="outline" className="text-xs">{rule.reminderTiming}</Badge>}
        </div>
      </div>
      {desc && (
        <p className="mt-2 text-sm text-gray-600">
          {truncated ? desc.slice(0, 180) + "..." : desc}
          {desc.length > 180 && <button className="ml-1 text-blue-600 text-xs" onClick={() => setExpanded(!expanded)}>{expanded ? "less" : "more"}</button>}
        </p>
      )}
      {rule.statuteCitation && <p className="mt-1.5 text-xs text-gray-400">Cite: {rule.statuteCitation}</p>}
      {rule.checklist?.length > 0 && (
        <ul className="mt-2 space-y-1">{rule.checklist.map((item: any, i: number) => (
          <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />{typeof item === "string" ? item : item.text ?? item.label}</li>
        ))}</ul>
      )}
      {rule.commonMistakes?.length > 0 && (
        <details className="mt-2"><summary className="flex items-center gap-1 text-xs text-amber-700 font-medium cursor-pointer"><ChevronDown className="h-3 w-3" />Common Mistakes</summary>
          <ul className="mt-1 space-y-0.5 pl-4 text-xs text-gray-600">{rule.commonMistakes.map((m: string, i: number) => <li key={i} className="list-disc">{m}</li>)}</ul>
        </details>
      )}
      {rule.tips?.length > 0 && (
        <details className="mt-2"><summary className="flex items-center gap-1 text-xs text-blue-700 font-medium cursor-pointer"><ChevronDown className="h-3 w-3" />Tips</summary>
          <ul className="mt-1 space-y-0.5 pl-4 text-xs text-gray-600">{rule.tips.map((t: string, i: number) => <li key={i} className="list-disc">{t}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

export default function CourtDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: court, isLoading } = trpc.courtRules["courts.get"].useQuery({ id: slug });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading court details...</div>;
  if (!court) return <div className="py-20 text-center text-gray-400">Court not found.</div>;

  const tb = courtTypeBadge[court.courtType] ?? { label: court.courtType, className: "bg-gray-100 text-gray-700" };
  const eb = (court.efilingSystem ? (eFilingBadge as any)[court.efilingSystem] : null) ?? { label: "None", className: "bg-gray-100 text-gray-500" };

  const rulesByCategory: Record<string, any[]> = {};
  (court.courtFilingRules ?? []).forEach((r: any) => {
    const cat = r.category ?? "OTHER";
    (rulesByCategory[cat] ??= []).push(r);
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{court.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge className={tb.className} variant="secondary">{tb.label}</Badge>
              <Badge className={eb.className} variant="secondary">{eb.label}</Badge>
              {court.jurisdiction && <Badge variant="outline">{court.jurisdiction}</Badge>}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
          {court.address && <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-gray-400" />{court.address}</p>}
          {court.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" />{court.phone}</p>}
        </div>
      </div>

      {/* Clerk info card */}
      {(court.clerkName || court.filingHours || court.paymentMethods || court.specialInstructions) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6 grid gap-2 text-sm sm:grid-cols-2">
          {court.clerkName && <p className="flex items-center gap-2"><Users className="h-4 w-4 text-gray-400" />Clerk: {court.clerkName}</p>}
          {court.filingHours && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" />Hours: {court.filingHours}</p>}
          {court.paymentMethods && <p className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-gray-400" />Payment: {court.paymentMethods}</p>}
          {court.specialInstructions && <p className="col-span-full text-gray-600">{court.specialInstructions}</p>}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="rules">
        <TabsList className="mb-4">
          <TabsTrigger value="rules"><FileText className="mr-1.5 h-4 w-4" />Filing Rules</TabsTrigger>
          <TabsTrigger value="judges"><Users className="mr-1.5 h-4 w-4" />Judges</TabsTrigger>
          <TabsTrigger value="efiling"><Upload className="mr-1.5 h-4 w-4" />E-Filing</TabsTrigger>
        </TabsList>

        {/* Tab 1: Filing Rules */}
        <TabsContent value="rules">
          {Object.keys(rulesByCategory).length === 0 ? (
            <p className="py-10 text-center text-gray-400">No filing rules recorded for this court.</p>
          ) : Object.entries(rulesByCategory).map(([cat, rules]) => (
            <div key={cat} className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">{cat.replace(/_/g, " ")}</h3>
              <div className="space-y-3">{rules.map((r: any) => <RuleCard key={r.id} rule={r} />)}</div>
            </div>
          ))}
        </TabsContent>

        {/* Tab 2: Judges */}
        <TabsContent value="judges">
          {(court.judgeProfiles ?? []).length === 0 ? (
            <p className="py-10 text-center text-gray-400">No judges recorded for this court.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(court.judgeProfiles ?? []).map((j: any) => (
                <div key={j.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h4 className="font-bold text-gray-900">{j.name}</h4>
                  {j.title && <p className="text-sm text-gray-500">{j.title}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    {j.part && <span>Part: {j.part}</span>}
                    {j.courtroom && <span>Room: {j.courtroom}</span>}
                    {j.clerkName && <span>Clerk: {j.clerkName}</span>}
                    {j.clerkPhone && <span>{j.clerkPhone}</span>}
                  </div>
                  {j.schedulingPreferences && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Scheduling Preferences</p>
                      <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto">{typeof j.schedulingPreferences === "string" ? j.schedulingPreferences : JSON.stringify(j.schedulingPreferences, null, 2)}</pre>
                    </div>
                  )}
                  {j.specificRules?.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-medium text-gray-500">Specific Rules</p>
                      {j.specificRules.map((r: any) => {
                        const s = severityConfig[r.severity] ?? severityConfig.RS_INFORMATIONAL!;
                        return <div key={r.id} className="flex items-center gap-2 text-xs"><Badge className={s.className} variant="secondary">{s.label}</Badge><span>{r.title}</span></div>;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: E-Filing */}
        <TabsContent value="efiling">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Badge className={eb.className} variant="secondary">{eb.label}</Badge>
              {court.efilingMandatory && <Badge variant="destructive">Mandatory</Badge>}
            </div>
            {court.efilingUrl && (
              <a href={court.efilingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <ExternalLink className="h-4 w-4" />{court.efilingUrl}
              </a>
            )}
            {court.efilingExemptions && (
              <div><p className="text-sm font-medium text-gray-700 mb-1">Exemptions</p><p className="text-sm text-gray-600">{court.efilingExemptions}</p></div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Registration Instructions</p>
              <p className="text-sm text-gray-500">Contact the court clerk or visit the e-filing portal above for account registration and filing instructions.</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
