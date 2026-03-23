"use client";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Sparkles, Loader2 } from "lucide-react";

interface NaturalLanguageInputProps {
  onCalculated: (result: any) => void;
}

const EXAMPLE_CHIPS = [
  "Complaint served personally March 1",
  "SJ motion filed Feb 15 in EDNY",
  "Note of issue filed Jan 10 Nassau Supreme",
  "Discovery demand received by mail March 5",
];

const LOADING_MESSAGES = [
  "Parsing your input...",
  "Identifying rules...",
  "Calculating deadlines...",
];

const TRIGGER_OPTIONS = [
  { value: "complaint_served", label: "Complaint Served" },
  { value: "motion_filed", label: "Motion Filed" },
  { value: "note_of_issue_filed", label: "Note of Issue Filed" },
  { value: "discovery_commenced", label: "Discovery Commenced" },
  { value: "trial_date_set", label: "Trial Date Set" },
  { value: "appeal_filed", label: "Appeal Filed" },
  { value: "petition_filed", label: "Petition Filed" },
  { value: "probate_filed", label: "Probate Filed" },
];

const JURISDICTION_OPTIONS = [
  { value: "ny_supreme", label: "NY Supreme" },
  { value: "ny_family", label: "NY Family" },
  { value: "ny_surrogate", label: "NY Surrogate" },
  { value: "ny_federal_edny", label: "EDNY" },
  { value: "ny_federal_sdny", label: "SDNY" },
  { value: "federal_general", label: "Federal" },
  { value: "ca_superior", label: "CA Superior" },
];

const SERVICE_OPTIONS = [
  { value: "personal", label: "Personal" },
  { value: "substituted", label: "Substituted" },
  { value: "nail_and_mail", label: "Nail & Mail" },
  { value: "first_class_mail", label: "First Class Mail" },
  { value: "publication", label: "Publication" },
  { value: "email_consent", label: "Email" },
  { value: "waiver", label: "Waiver" },
];

export default function NaturalLanguageInput({
  onCalculated,
}: NaturalLanguageInputProps) {
  const [text, setText] = useState("");
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [parsedParams, setParsedParams] = useState<{
    triggerEvent: string;
    triggerDate: string;
    jurisdiction: string;
    serviceMethod: string;
    practiceArea?: string;
  } | null>(null);
  const [paramsEdited, setParamsEdited] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculateMutation =
    trpc.deadlineCalculator.calculateFromText.useMutation({
      onSuccess: (data) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (data.parsed) {
          setParsedParams({
            triggerEvent: data.parsed.triggerEvent ?? "",
            triggerDate: data.parsed.triggerDate ?? "",
            jurisdiction: data.parsed.jurisdiction ?? "",
            serviceMethod: data.parsed.serviceMethod ?? "",
          });
        }
        onCalculated(data);
      },
      onError: () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      },
    });

  function handleCalculate() {
    if (!text.trim()) return;
    setParsedParams(null);
    setParamsEdited(false);
    setLoadingMsgIndex(0);

    // Cycle loading messages
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, LOADING_MESSAGES.length - 1);
      setLoadingMsgIndex(idx);
    }, 1500);

    calculateMutation.mutate({ text: text.trim() });
  }

  function handleRecalculate() {
    if (!parsedParams) return;
    setParamsEdited(false);
    setLoadingMsgIndex(0);

    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, LOADING_MESSAGES.length - 1);
      setLoadingMsgIndex(idx);
    }, 1500);

    calculateMutation.mutate({
      text: text.trim(),
      practiceArea: parsedParams?.practiceArea || undefined,
      jurisdiction: parsedParams?.jurisdiction || undefined,
    });
  }

  function updateParam(key: string, value: string) {
    if (!parsedParams) return;
    setParsedParams({ ...parsedParams, [key]: value });
    setParamsEdited(true);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const inputClasses =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400";

  return (
    <div className="space-y-4">
      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Describe the trigger event... e.g., 'Complaint served personally on defendant March 1, 2026 in Nassau County Supreme Court'"
        className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
      />

      {/* Example chips */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_CHIPS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
          >
            {example}
          </button>
        ))}
      </div>

      {/* Calculate button */}
      <button
        type="button"
        onClick={handleCalculate}
        disabled={calculateMutation.isPending || !text.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
      >
        {calculateMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {LOADING_MESSAGES[loadingMsgIndex]}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Calculate Deadlines
          </>
        )}
      </button>

      {/* Parsed params (editable) */}
      {parsedParams && !calculateMutation.isPending && (
        <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-4">
          <p className="mb-3 text-xs font-medium text-purple-800">
            Extracted Parameters
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Trigger */}
            <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs text-slate-500">Trigger:</span>
              <select
                value={parsedParams.triggerEvent}
                onChange={(e) => updateParam("triggerEvent", e.target.value)}
                className={inputClasses}
              >
                <option value="">--</option>
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs text-slate-500">Date:</span>
              <input
                type="date"
                value={parsedParams.triggerDate}
                onChange={(e) => updateParam("triggerDate", e.target.value)}
                className={inputClasses}
              />
            </div>

            {/* Jurisdiction */}
            <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs text-slate-500">Jurisdiction:</span>
              <select
                value={parsedParams.jurisdiction}
                onChange={(e) => updateParam("jurisdiction", e.target.value)}
                className={inputClasses}
              >
                <option value="">--</option>
                {JURISDICTION_OPTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Service */}
            <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <span className="text-xs text-slate-500">Service:</span>
              <select
                value={parsedParams.serviceMethod}
                onChange={(e) => updateParam("serviceMethod", e.target.value)}
                className={inputClasses}
              >
                <option value="">--</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recalculate */}
          {paramsEdited && (
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={calculateMutation.isPending}
              className="mt-3 rounded-lg border border-purple-300 bg-white px-4 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
            >
              Recalculate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
