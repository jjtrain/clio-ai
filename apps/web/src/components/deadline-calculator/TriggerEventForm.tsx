"use client";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Calculator } from "lucide-react";

interface TriggerEventFormProps {
  onCalculated: (result: any) => void;
}

const TRIGGER_EVENTS = [
  { value: "complaint_served", label: "Complaint Served" },
  { value: "motion_filed", label: "Motion Filed" },
  { value: "note_of_issue_filed", label: "Note of Issue Filed" },
  { value: "discovery_commenced", label: "Discovery Commenced" },
  { value: "trial_date_set", label: "Trial Date Set" },
  { value: "appeal_filed", label: "Appeal Filed" },
  { value: "petition_filed", label: "Petition Filed" },
  { value: "probate_filed", label: "Probate Filed" },
  { value: "custom", label: "Custom" },
];

const JURISDICTIONS = {
  "NY State": [
    { value: "ny_supreme", label: "NY Supreme Court" },
    { value: "ny_family", label: "NY Family Court" },
    { value: "ny_surrogate", label: "NY Surrogate's Court" },
  ],
  "NY Federal": [
    { value: "ny_federal_edny", label: "EDNY (Eastern District)" },
    { value: "ny_federal_sdny", label: "SDNY (Southern District)" },
  ],
  Other: [
    { value: "federal_general", label: "Federal (General)" },
    { value: "ca_superior", label: "CA Superior Court" },
    { value: "custom", label: "Custom" },
  ],
};

const PRACTICE_AREAS = [
  { value: "personal_injury", label: "Personal Injury" },
  { value: "family_law", label: "Family Law" },
  { value: "estate_planning", label: "Estate Planning" },
  { value: "corporate", label: "Corporate" },
  { value: "litigation", label: "Litigation" },
  { value: "criminal", label: "Criminal" },
  { value: "real_estate", label: "Real Estate" },
  { value: "immigration", label: "Immigration" },
  { value: "general", label: "General" },
];

const SERVICE_METHODS = [
  { value: "personal", label: "Personal Service" },
  { value: "substituted", label: "Substituted Service" },
  { value: "nail_and_mail", label: "Nail & Mail" },
  { value: "first_class_mail", label: "First Class Mail" },
  { value: "publication", label: "Service by Publication" },
  { value: "email_consent", label: "Email (with Consent)" },
  { value: "waiver", label: "Waiver of Service" },
];

const SERVICE_TRIGGERS = ["complaint_served", "discovery_commenced"];

export default function TriggerEventForm({ onCalculated }: TriggerEventFormProps) {
  const [triggerEvent, setTriggerEvent] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [serviceMethod, setServiceMethod] = useState("");
  const [matterLink, setMatterLink] = useState("");
  const [chainName, setChainName] = useState("");
  const [chainNameTouched, setChainNameTouched] = useState(false);

  const showServiceMethod = SERVICE_TRIGGERS.includes(triggerEvent);

  const autoChainName = useMemo(() => {
    const triggerLabel =
      TRIGGER_EVENTS.find((t) => t.value === triggerEvent)?.label ?? "";
    const matter = matterLink || "Matter";
    return triggerLabel ? `${matter} \u2014 ${triggerLabel} Deadlines` : "";
  }, [triggerEvent, matterLink]);

  const displayChainName = chainNameTouched ? chainName : autoChainName;

  const calculateMutation =
    trpc.deadlineCalculator.calculateFromForm.useMutation({
      onSuccess: (data) => {
        onCalculated(data);
      },
    });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    calculateMutation.mutate({
      triggerEvent,
      triggerDate,
      jurisdiction,
      practiceArea,
      serviceMethod: showServiceMethod ? serviceMethod : undefined,
      matterId: matterLink || undefined,
      name: displayChainName || undefined,
    });
  }

  const inputClasses =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
  const labelClasses = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Trigger Event */}
      <div>
        <label className={labelClasses}>Trigger Event</label>
        <select
          value={triggerEvent}
          onChange={(e) => setTriggerEvent(e.target.value)}
          className={inputClasses}
          required
        >
          <option value="">Select trigger event...</option>
          {TRIGGER_EVENTS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Trigger Date */}
      <div>
        <label className={labelClasses}>Trigger Date</label>
        <input
          type="date"
          value={triggerDate}
          onChange={(e) => setTriggerDate(e.target.value)}
          className={inputClasses}
          required
        />
      </div>

      {/* Jurisdiction */}
      <div>
        <label className={labelClasses}>Jurisdiction</label>
        <select
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className={inputClasses}
          required
        >
          <option value="">Select jurisdiction...</option>
          {Object.entries(JURISDICTIONS).map(([group, options]) => (
            <optgroup key={group} label={group}>
              {options.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Practice Area */}
      <div>
        <label className={labelClasses}>Practice Area</label>
        <select
          value={practiceArea}
          onChange={(e) => setPracticeArea(e.target.value)}
          className={inputClasses}
          required
        >
          <option value="">Select practice area...</option>
          {PRACTICE_AREAS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Service Method (conditional) */}
      {showServiceMethod && (
        <div>
          <label className={labelClasses}>Service Method</label>
          <select
            value={serviceMethod}
            onChange={(e) => setServiceMethod(e.target.value)}
            className={inputClasses}
            required
          >
            <option value="">Select service method...</option>
            {SERVICE_METHODS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Matter Link */}
      <div>
        <label className={labelClasses}>
          Matter Link{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={matterLink}
          onChange={(e) => setMatterLink(e.target.value)}
          placeholder="Matter ID or reference"
          className={inputClasses}
        />
      </div>

      {/* Chain Name */}
      <div>
        <label className={labelClasses}>Chain Name</label>
        <input
          type="text"
          value={displayChainName}
          onChange={(e) => {
            setChainName(e.target.value);
            setChainNameTouched(true);
          }}
          placeholder="Auto-generated from selections"
          className={inputClasses}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={calculateMutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
      >
        {calculateMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculating...
          </>
        ) : (
          <>
            <Calculator className="h-4 w-4" />
            Calculate Deadlines
          </>
        )}
      </button>
    </form>
  );
}
