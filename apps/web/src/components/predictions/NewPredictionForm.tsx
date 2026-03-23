"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Sparkles, Target } from "lucide-react";

interface NewPredictionFormProps {
  onBack: () => void;
  onComplete: (predictionId: string) => void;
}

const CASE_TYPES: Record<string, Array<{ value: string; label: string }>> = {
  personal_injury: [
    { value: "personal_injury_auto", label: "Auto Accident" },
    { value: "personal_injury_slip_fall", label: "Slip & Fall" },
    { value: "personal_injury_med_mal", label: "Medical Malpractice" },
  ],
  family_law: [
    { value: "divorce_contested", label: "Contested Divorce" },
    { value: "divorce_uncontested", label: "Uncontested Divorce" },
    { value: "custody", label: "Custody" },
  ],
  immigration: [
    { value: "immigration_asylum", label: "Asylum" },
    { value: "immigration_visa", label: "Visa Application" },
  ],
  corporate: [
    { value: "contract_dispute", label: "Contract Dispute" },
  ],
  litigation: [
    { value: "employment_discrimination", label: "Employment Discrimination" },
  ],
  real_estate: [
    { value: "real_estate_closing", label: "Real Estate Closing" },
  ],
  estate_planning: [
    { value: "estate_probate", label: "Probate" },
  ],
  criminal: [
    { value: "criminal_misdemeanor", label: "Misdemeanor" },
    { value: "criminal_felony", label: "Felony" },
  ],
  general: [
    { value: "general", label: "General" },
  ],
};

const PRACTICE_AREAS = [
  { value: "personal_injury", label: "Personal Injury" },
  { value: "family_law", label: "Family Law" },
  { value: "immigration", label: "Immigration" },
  { value: "corporate", label: "Corporate" },
  { value: "litigation", label: "Litigation" },
  { value: "criminal", label: "Criminal" },
  { value: "real_estate", label: "Real Estate" },
  { value: "estate_planning", label: "Estate Planning" },
  { value: "general", label: "General" },
];

const JURISDICTIONS = [
  { value: "", label: "Not specified" },
  { value: "ny_supreme", label: "NY Supreme Court" },
  { value: "ny_federal_edny", label: "EDNY" },
  { value: "ny_federal_sdny", label: "SDNY" },
  { value: "ny_family", label: "NY Family Court" },
  { value: "ca_superior", label: "CA Superior Court" },
  { value: "federal_general", label: "Federal (General)" },
];

const LOADING_PHASES = [
  "Analyzing case factors...",
  "Comparing against benchmarks...",
  "Running AI analysis...",
  "Generating recommendations...",
  "Calculating prediction...",
];

export function NewPredictionForm({ onBack, onComplete }: NewPredictionFormProps) {
  const [matterName, setMatterName] = useState("");
  const [matterId, setMatterId] = useState("");
  const [practiceArea, setPracticeArea] = useState("personal_injury");
  const [caseType, setCaseType] = useState("personal_injury_auto");
  const [jurisdiction, setJurisdiction] = useState("");
  const [loadingPhase, setLoadingPhase] = useState(0);

  // Factor inputs
  const [factors, setFactors] = useState<Record<string, string>>({
    liability_strength: "7",
    damages_severity: "6",
    insurance_coverage: "adequate",
    witness_quality: "6",
    expert_quality: "5",
    jurisdiction_favorability: "neutral",
    judge_tendencies: "neutral",
  });

  const factorsQuery = trpc.predictions.getFactors.useQuery({ practiceArea });
  const availableFactors = factorsQuery.data ?? [];

  const caseTypeOptions = useMemo(() => CASE_TYPES[practiceArea] || CASE_TYPES.general, [practiceArea]);

  const calculateMutation = trpc.predictions.calculate.useMutation({
    onSuccess: (data: any) => {
      onComplete(data.id);
    },
  });

  function handlePracticeAreaChange(val: string) {
    setPracticeArea(val);
    const types = CASE_TYPES[val] || CASE_TYPES.general;
    setCaseType(types[0]?.value || "general");
  }

  function updateFactor(name: string, value: string) {
    setFactors((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matterName.trim()) return;

    let phase = 0;
    const interval = setInterval(() => {
      phase = Math.min(phase + 1, LOADING_PHASES.length - 1);
      setLoadingPhase(phase);
    }, 2500);

    const factorInputs = Object.entries(factors)
      .filter(([, v]) => v !== "")
      .map(([name, value]) => ({
        factorName: name,
        inputValue: value,
        source: "attorney_input",
      }));

    calculateMutation.mutate(
      {
        matterId: matterId || `matter-${Date.now()}`,
        matterName,
        practiceArea,
        caseType,
        jurisdiction: jurisdiction || undefined,
        factorInputs,
      },
      { onSettled: () => clearInterval(interval) }
    );
  }

  const inputClasses = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
  const labelClasses = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">New Prediction</h2>
          <p className="text-sm text-slate-500">Score a matter&apos;s likely outcome based on case factors</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Matter Info */}
          <div className="space-y-5 lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Matter Details</h3>
              <div>
                <label className={labelClasses}>Matter Name</label>
                <input type="text" value={matterName} onChange={(e) => setMatterName(e.target.value)}
                  placeholder="e.g., Smith v. Jones" className={inputClasses} required />
              </div>
              <div>
                <label className={labelClasses}>Matter ID (optional)</label>
                <input type="text" value={matterId} onChange={(e) => setMatterId(e.target.value)}
                  placeholder="Link to existing matter" className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>Practice Area</label>
                <select value={practiceArea} onChange={(e) => handlePracticeAreaChange(e.target.value)} className={inputClasses}>
                  {PRACTICE_AREAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Case Type</label>
                <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className={inputClasses}>
                  {caseTypeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Jurisdiction</label>
                <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={inputClasses}>
                  {JURISDICTIONS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Right: Factors */}
          <div className="space-y-5 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
              <h3 className="text-sm font-semibold text-slate-700">Case Strength Factors</h3>
              <p className="text-xs text-slate-500">Rate each factor to generate the prediction score. Leave defaults for unknown factors.</p>

              <div className="grid gap-4 sm:grid-cols-2">
                {availableFactors.map((factor: any) => {
                  if (factor.inputType === "auto_calculated") return null;

                  return (
                    <div key={factor.factorName}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {factor.factorName.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        <span className="ml-1 text-slate-400 font-normal">
                          (w: {(factor.weightDefault * 100).toFixed(0)}%)
                        </span>
                      </label>

                      {factor.inputType === "scale_1_10" ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={factors[factor.factorName] || "5"}
                            onChange={(e) => updateFactor(factor.factorName, e.target.value)}
                            className="flex-1 h-2 rounded-full appearance-none bg-slate-200 accent-slate-900"
                          />
                          <span className="w-8 text-center text-sm font-semibold text-slate-700">
                            {factors[factor.factorName] || "5"}
                          </span>
                        </div>
                      ) : factor.inputType === "select" && factor.selectOptions ? (
                        <select
                          value={factors[factor.factorName] || ""}
                          onChange={(e) => updateFactor(factor.factorName, e.target.value)}
                          className={inputClasses + " text-xs"}
                        >
                          {factor.selectOptions.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={factors[factor.factorName] || ""}
                          onChange={(e) => updateFactor(factor.factorName, e.target.value)}
                          className={inputClasses + " text-xs"}
                        />
                      )}

                      <p className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">
                        {factor.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          <button type="button" onClick={onBack}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={calculateMutation.isPending || !matterName.trim()}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50">
            {calculateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{LOADING_PHASES[loadingPhase]}</>
            ) : (
              <><Sparkles className="h-4 w-4" />Generate Prediction</>
            )}
          </button>
        </div>

        {calculateMutation.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Error: {calculateMutation.error?.message || "Prediction failed."}
          </div>
        )}
      </form>
    </div>
  );
}
