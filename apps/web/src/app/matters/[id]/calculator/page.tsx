"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Calculator, DollarSign, Users, ChevronDown, ChevronRight,
  Save, Copy, Trash2, Pin, AlertTriangle, Info, Scale,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const JURISDICTIONS = [
  { code: "NY", name: "New York", flag: "🗽" },
  { code: "CA", name: "California", flag: "🌴" },
  { code: "FL", name: "Florida", flag: "🌞" },
  { code: "TX", name: "Texas", flag: "⭐" },
  { code: "IL", name: "Illinois", flag: "🏙️" },
];

const CUSTODY_OPTIONS = [
  { value: "sole", label: "Sole/Primary Custody" },
  { value: "shared", label: "Shared Custody (40%+)" },
];

export default function CalculatorPage() {
  const params = useParams();
  const matterId = params.id as string;

  const [jurisdiction, setJurisdiction] = useState("NY");
  const [calcType, setCalcType] = useState<"CHILD_SUPPORT" | "MAINTENANCE" | "COMBINED">("CHILD_SUPPORT");
  const [showAddOns, setShowAddOns] = useState(false);
  const [scenarioLabel, setScenarioLabel] = useState("Scenario 1");

  // Input state
  const [payorIncome, setPayorIncome] = useState(120000);
  const [payeeIncome, setPayeeIncome] = useState(45000);
  const [numChildren, setNumChildren] = useState(2);
  const [custody, setCustody] = useState("sole");
  const [payorCustodyPct, setPayorCustodyPct] = useState(20);
  const [payorTimeshare, setPayorTimeshare] = useState(20);
  const [overnights, setOvernights] = useState(73);
  const [childcare, setChildcare] = useState(0);
  const [healthIns, setHealthIns] = useState(0);
  const [marriageYears, setMarriageYears] = useState(10);
  const [childSupportPaid, setChildSupportPaid] = useState(0);
  const [aboveCap, setAboveCap] = useState<"discretion_below" | "apply_percentage">("discretion_below");

  // Results
  const [result, setResult] = useState<any>(null);

  const calcMut = trpc.supportCalculator.calculate.useMutation({ onSuccess: (data) => setResult(data) });
  const saveMut = trpc.supportCalculator.saveCalculation.useMutation({ onSuccess: () => savedQuery.refetch() });
  const savedQuery = trpc.supportCalculator.listCalculations.useQuery({ matterId });
  const pinMut = trpc.supportCalculator.pinCalculation.useMutation({ onSuccess: () => savedQuery.refetch() });
  const deleteMut = trpc.supportCalculator.deleteCalculation.useMutation({ onSuccess: () => savedQuery.refetch() });

  const saved = savedQuery.data || [];

  // Live calculation
  const runCalc = useCallback(() => {
    const inputs: any = {
      payorGrossAnnualIncome: payorIncome, payeeGrossAnnualIncome: payeeIncome,
      numberOfChildren: numChildren, childrenAges: Array.from({ length: numChildren }, (_, i) => 8 + i),
      payorOtherChildSupportOrders: 0, payeeOtherChildSupportOrders: 0,
      payorSSTaxDeduction: 0, payeeSSTaxDeduction: 0,
      childHealthInsurancePremium: healthIns, childHealthInsurancePaidBy: "payee",
      childcareExpensesAnnual: childcare, childcareExpensesPaidBy: "payee",
      educationalExpensesAnnual: 0, educationalExpensesPaidBy: "split",
      unreimbursedMedicalAnnual: 0, unreimbursedMedicalPaidBy: "split",
      custodyArrangement: custody, payorCustodyPercent: payorCustodyPct,
      combinedIncomeAboveCap: aboveCap,
      payorTimesharePercent: payorTimeshare,
      payorActualFederalTaxRate: payorIncome > 180000 ? 24 : payorIncome > 90000 ? 22 : 12,
      payorActualStateTaxRate: 6, payeeActualFederalTaxRate: payeeIncome > 90000 ? 22 : 12, payeeActualStateTaxRate: 4,
      payorHealthInsurancePremium: 0, payeeHealthInsurancePremium: 0,
      payorMandatoryRetirement: 0, payeeMandatoryRetirement: 0,
      overnightsWithPayor: overnights,
      // Maintenance
      marriageDurationYears: marriageYears, payorAge: 42, payeeAge: 40,
      childSupportBeingPaid: childSupportPaid, payorMaintainHealthInsurance: false, jurisdiction,
    };
    calcMut.mutate({ inputs, calcType, jurisdiction });
  }, [payorIncome, payeeIncome, numChildren, custody, payorCustodyPct, payorTimeshare, overnights, childcare, healthIns, marriageYears, childSupportPaid, aboveCap, calcType, jurisdiction]);

  useEffect(() => {
    const timer = setTimeout(runCalc, 200);
    return () => clearTimeout(timer);
  }, [runCalc]);

  const cs = result?.childSupport;
  const maint = result?.maintenance;

  function handleSave() {
    saveMut.mutate({ matterId, label: scenarioLabel, inputs: { payorIncome, payeeIncome, numChildren, custody, jurisdiction }, results: result, calcType, jurisdiction });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Scale className="h-7 w-7 text-indigo-600" /> Support Calculator</h1>
          <div className="flex gap-2 mt-2">
            {JURISDICTIONS.map((j) => (
              <button key={j.code} onClick={() => setJurisdiction(j.code)}
                className={cn("px-3 py-1 rounded-full text-sm font-medium", jurisdiction === j.code ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}>
                {j.flag} {j.code}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {(["CHILD_SUPPORT", "MAINTENANCE", "COMBINED"] as const).map((ct) => (
            <button key={ct} onClick={() => setCalcType(ct)}
              className={cn("px-3 py-1.5 rounded text-xs font-medium", calcType === ct ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600")}>
              {ct === "CHILD_SUPPORT" ? "Child Support" : ct === "MAINTENANCE" ? "Maintenance" : "Both"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6">
        {/* LEFT: Inputs */}
        <div className="space-y-4">
          {/* Income */}
          <Card className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Party Income</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Payor (Non-Custodial)</label>
                <div className="relative mt-1">
                  <DollarSign className="h-4 w-4 absolute left-2 top-2 text-gray-400" />
                  <Input type="number" value={payorIncome} onChange={(e) => setPayorIncome(Number(e.target.value))} className="pl-7 h-9 text-sm font-mono" />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">= ${Math.round(payorIncome / 12).toLocaleString()}/mo</p>
              </div>
              <div>
                <label className="text-xs text-gray-600">Payee (Custodial)</label>
                <div className="relative mt-1">
                  <DollarSign className="h-4 w-4 absolute left-2 top-2 text-gray-400" />
                  <Input type="number" value={payeeIncome} onChange={(e) => setPayeeIncome(Number(e.target.value))} className="pl-7 h-9 text-sm font-mono" />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">= ${Math.round(payeeIncome / 12).toLocaleString()}/mo</p>
              </div>
            </div>
          </Card>

          {/* Children */}
          {(calcType === "CHILD_SUPPORT" || calcType === "COMBINED") && (
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Users className="h-3 w-3" /> Children</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Number:</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setNumChildren(Math.max(1, numChildren - 1))}>-</Button>
                  <span className="text-lg font-bold w-8 text-center">{numChildren}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setNumChildren(Math.min(6, numChildren + 1))}>+</Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Custody</label>
                <Select value={custody} onValueChange={setCustody}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CUSTODY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {custody === "shared" && (
                <div>
                  <label className="text-xs text-gray-600">Payor overnights/year: {overnights} ({Math.round(overnights / 365 * 100)}%)</label>
                  <input type="range" min={0} max={182} value={overnights} onChange={(e) => setOvernights(Number(e.target.value))} className="w-full mt-1" />
                </div>
              )}
              {jurisdiction === "CA" && (
                <div>
                  <label className="text-xs text-gray-600">Payor timeshare: {payorTimeshare}%</label>
                  <input type="range" min={0} max={50} value={payorTimeshare} onChange={(e) => setPayorTimeshare(Number(e.target.value))} className="w-full mt-1" />
                </div>
              )}
              {jurisdiction === "NY" && (
                <div>
                  <label className="text-xs text-gray-600">Above income cap handling</label>
                  <Select value={aboveCap} onValueChange={(v: any) => setAboveCap(v)}>
                    <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discretion_below">Cap only (court discretion above)</SelectItem>
                      <SelectItem value="apply_percentage">Apply percentage above cap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>
          )}

          {/* Add-ons */}
          <Card className="p-4">
            <button onClick={() => setShowAddOns(!showAddOns)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase">
              {showAddOns ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Add-On Expenses
            </button>
            {showAddOns && (
              <div className="mt-3 space-y-2">
                <div><label className="text-xs text-gray-600">Childcare (annual)</label><Input type="number" value={childcare} onChange={(e) => setChildcare(Number(e.target.value))} className="h-7 text-sm mt-0.5" /></div>
                <div><label className="text-xs text-gray-600">Child health insurance (monthly)</label><Input type="number" value={healthIns} onChange={(e) => setHealthIns(Number(e.target.value))} className="h-7 text-sm mt-0.5" /></div>
              </div>
            )}
          </Card>

          {/* Maintenance inputs */}
          {(calcType === "MAINTENANCE" || calcType === "COMBINED") && (
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Maintenance</h3>
              <div><label className="text-xs text-gray-600">Marriage duration (years)</label><Input type="number" value={marriageYears} onChange={(e) => setMarriageYears(Number(e.target.value))} className="h-8 text-sm mt-1" /></div>
              {calcType === "COMBINED" && (
                <div><label className="text-xs text-gray-600">Child support being paid (annual)</label><Input type="number" value={childSupportPaid} onChange={(e) => setChildSupportPaid(Number(e.target.value))} className="h-8 text-sm mt-1" /></div>
              )}
            </Card>
          )}

          {/* Save */}
          <Card className="p-4 flex items-center gap-2">
            <Input value={scenarioLabel} onChange={(e) => setScenarioLabel(e.target.value)} className="h-8 text-sm flex-1" placeholder="Scenario name" />
            <Button size="sm" onClick={handleSave} disabled={saveMut.isLoading}><Save className="h-3 w-3 mr-1" /> Save</Button>
          </Card>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-4">
          {/* Hero */}
          {cs && (
            <Card className="p-6 bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
              <p className="text-xs text-indigo-500 uppercase font-semibold tracking-wider">Guideline Child Support</p>
              <p className="text-4xl font-bold text-indigo-900 mt-1">${cs.guidelineMonthlyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}<span className="text-lg text-indigo-400"> / month</span></p>
              <p className="text-sm text-gray-500 mt-1">${Math.round(cs.guidelineMonthlyAmount * 12).toLocaleString()} / year · Payor → Payee</p>
              <Badge className="mt-2 text-[10px] bg-indigo-100 text-indigo-700">{cs.formulaVersion}</Badge>
            </Card>
          )}

          {maint && maint.guidelineMonthlyAmount > 0 && (
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-white border-purple-200">
              <div className="flex items-center gap-2">
                <p className="text-xs text-purple-500 uppercase font-semibold tracking-wider">Guideline Maintenance</p>
                {!maint.isStatutoryFormula && <Badge className="text-[9px] bg-amber-100 text-amber-700">Advisory</Badge>}
              </div>
              <p className="text-4xl font-bold text-purple-900 mt-1">${maint.guidelineMonthlyAmount.toLocaleString()}<span className="text-lg text-purple-400"> / month</span></p>
              {maint.durationRange ? (
                <p className="text-sm text-gray-500 mt-1">Duration: {Math.round(maint.durationRange.min / 12)}-{Math.round(maint.durationRange.max / 12)} years</p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Duration: ~{Math.round(maint.durationMonths / 12)} years</p>
              )}
              {maint.amountRange && <p className="text-xs text-gray-400">Range: ${maint.amountRange.min.toLocaleString()} – ${maint.amountRange.max.toLocaleString()}/mo</p>}
            </Card>
          )}

          {/* Formula Breakdown */}
          {cs?.formulaBreakdown?.length > 0 && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Formula Breakdown</h3>
              <div className="space-y-1">
                {cs.formulaBreakdown.map((step: any, i: number) => (
                  <div key={i} className={cn("flex items-center justify-between py-1.5 px-2 rounded text-sm", i === cs.formulaBreakdown.length - 1 ? "bg-indigo-50 font-semibold" : "")}>
                    <div>
                      <span className="text-gray-800">{step.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{step.formula}</span>
                      {step.note && <span className="text-[10px] text-indigo-500 ml-1">{step.note}</span>}
                    </div>
                    <span className="font-mono text-gray-900">${typeof step.result === "number" && step.result > 1 ? Math.round(step.result).toLocaleString() : step.result}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Add-ons */}
          {cs?.addOns?.length > 0 && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Add-On Expenses</h3>
              <div className="overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>
                    <th className="text-left px-3 py-2">Expense</th><th className="text-right px-3 py-2">Annual</th>
                    <th className="text-right px-3 py-2">Payor Share</th><th className="text-right px-3 py-2">Monthly</th>
                  </tr></thead>
                  <tbody>{cs.addOns.map((a: any, i: number) => (
                    <tr key={i} className="border-t"><td className="px-3 py-1.5">{a.label}</td><td className="text-right px-3">${a.annualCost.toLocaleString()}</td>
                    <td className="text-right px-3">{(a.payorShare * 100).toFixed(1)}%</td><td className="text-right px-3 font-mono">${a.payorMonthly.toFixed(2)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Warnings */}
          {(cs?.warnings?.length > 0 || maint?.warnings?.length > 0) && (
            <Card className="p-4 space-y-2">
              {[...(cs?.warnings || []), ...(maint?.warnings || [])].map((w: string, i: number) => (
                <div key={i} className="flex gap-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />{w}
                </div>
              ))}
              {[...(cs?.assumptions || []), ...(maint?.assumptions || [])].map((a: string, i: number) => (
                <div key={i} className="flex gap-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  <Info className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />{a}
                </div>
              ))}
            </Card>
          )}

          {/* Saved Scenarios */}
          {saved.length > 0 && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Saved Scenarios</h3>
              <div className="space-y-2">
                {saved.map((s: any) => (
                  <div key={s.id} className={cn("flex items-center justify-between p-2 rounded border", s.isPinned ? "border-indigo-300 bg-indigo-50" : "border-gray-100")}>
                    <div>
                      <span className="text-sm font-medium text-gray-800">{s.label}</span>
                      {s.isPinned && <Badge className="ml-2 text-[9px] bg-indigo-100 text-indigo-700">Pinned</Badge>}
                      <p className="text-[10px] text-gray-400">{s.jurisdiction} · {s.formulaVersion} · {new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => pinMut.mutate({ id: s.id })} className="p-1 text-gray-400 hover:text-indigo-600"><Pin className="h-3 w-3" /></button>
                      <button onClick={() => deleteMut.mutate({ id: s.id })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
