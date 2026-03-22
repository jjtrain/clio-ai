"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Briefcase,
  Mail,
  Gavel,
  FileText,
  Shield,
  Heart,
  Users,
  AlarmClock,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  ArrowLeft,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftWizardProps {
  initialType?: string;
  onComplete: (draftId: string) => void;
  onCancel: () => void;
}

type CorrespondenceType =
  | "opposing_counsel_letter"
  | "client_update_email"
  | "court_filing_cover"
  | "demand_letter"
  | "settlement_offer"
  | "discovery_request_cover"
  | "scheduling_letter"
  | "custom";

type RecipientType =
  | "opposing_counsel"
  | "client"
  | "court_clerk"
  | "judge"
  | "insurance_adjuster"
  | "expert_witness"
  | "co_counsel"
  | "custom";

type ToneOption =
  | "professional"
  | "firm"
  | "cordial"
  | "urgent"
  | "sympathetic"
  | "formal_court";

type FormatOption = "email" | "letter" | "filing_cover";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  "Select Matter",
  "Type",
  "Recipient",
  "Tone & Format",
  "Generate",
] as const;

const TYPE_CARDS: {
  value: CorrespondenceType;
  icon: typeof Briefcase;
  label: string;
  description: string;
}[] = [
  {
    value: "opposing_counsel_letter",
    icon: Briefcase,
    label: "Letter to Opposing Counsel",
    description: "Meet & confer, extensions, demands",
  },
  {
    value: "client_update_email",
    icon: Mail,
    label: "Client Update Email",
    description: "Status updates, welcome, billing",
  },
  {
    value: "court_filing_cover",
    icon: Gavel,
    label: "Court Filing Cover",
    description: "Motion, response, notice cover letters",
  },
  {
    value: "demand_letter",
    icon: FileText,
    label: "Demand Letter",
    description: "Personal injury, breach, collections",
  },
  {
    value: "settlement_offer",
    icon: FileText,
    label: "Settlement Offer",
    description: "Offers, counter-offers, terms",
  },
  {
    value: "discovery_request_cover",
    icon: FileText,
    label: "Discovery Cover",
    description: "Interrogatories, document requests",
  },
  {
    value: "scheduling_letter",
    icon: FileText,
    label: "Scheduling Letter",
    description: "Conference, hearing, deposition scheduling",
  },
  {
    value: "custom",
    icon: Sparkles,
    label: "Custom",
    description: "Describe what you need",
  },
];

const TONE_CARDS: {
  value: ToneOption;
  icon: typeof Briefcase;
  label: string;
  description: string;
}[] = [
  {
    value: "professional",
    icon: Briefcase,
    label: "Professional",
    description: "Standard business tone",
  },
  {
    value: "firm",
    icon: Shield,
    label: "Firm",
    description: "Assertive, clear boundaries",
  },
  {
    value: "cordial",
    icon: Users,
    label: "Cordial",
    description: "Warm, relationship-building",
  },
  {
    value: "urgent",
    icon: AlarmClock,
    label: "Urgent",
    description: "Time-sensitive, action required",
  },
  {
    value: "sympathetic",
    icon: Heart,
    label: "Sympathetic",
    description: "Empathetic, understanding",
  },
  {
    value: "formal_court",
    icon: Gavel,
    label: "Formal Court",
    description: "Court-appropriate formality",
  },
];

const RECIPIENT_OPTIONS: { value: RecipientType; label: string }[] = [
  { value: "opposing_counsel", label: "Opposing Counsel" },
  { value: "client", label: "Client" },
  { value: "court_clerk", label: "Court Clerk" },
  { value: "judge", label: "Judge" },
  { value: "insurance_adjuster", label: "Insurance Adjuster" },
  { value: "expert_witness", label: "Expert Witness" },
  { value: "co_counsel", label: "Co-Counsel" },
  { value: "custom", label: "Custom" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultRecipientType(type: CorrespondenceType): RecipientType {
  const map: Partial<Record<CorrespondenceType, RecipientType>> = {
    opposing_counsel_letter: "opposing_counsel",
    client_update_email: "client",
    court_filing_cover: "court_clerk",
    demand_letter: "opposing_counsel",
    settlement_offer: "opposing_counsel",
    discovery_request_cover: "opposing_counsel",
    scheduling_letter: "opposing_counsel",
  };
  return map[type] ?? "custom";
}

function defaultTone(type: CorrespondenceType): ToneOption {
  const map: Partial<Record<CorrespondenceType, ToneOption>> = {
    court_filing_cover: "formal_court",
    demand_letter: "firm",
    client_update_email: "professional",
    opposing_counsel_letter: "professional",
    settlement_offer: "professional",
    discovery_request_cover: "professional",
    scheduling_letter: "cordial",
  };
  return map[type] ?? "professional";
}

function defaultFormat(type: CorrespondenceType): FormatOption {
  const map: Partial<Record<CorrespondenceType, FormatOption>> = {
    client_update_email: "email",
    court_filing_cover: "filing_cover",
  };
  return map[type] ?? "letter";
}

function toneLabel(t: ToneOption): string {
  return TONE_CARDS.find((c) => c.value === t)?.label ?? t;
}

function typeLabel(t: CorrespondenceType): string {
  return TYPE_CARDS.find((c) => c.value === t)?.label ?? t;
}

function recipientLabel(r: RecipientType): string {
  return RECIPIENT_OPTIONS.find((o) => o.value === r)?.label ?? r;
}

function formatLabel(f: FormatOption): string {
  const map: Record<FormatOption, string> = {
    email: "Email",
    letter: "Formal Letter",
    filing_cover: "Filing Cover",
  };
  return map[f];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftWizard({
  initialType,
  onComplete,
  onCancel,
}: DraftWizardProps) {
  // Step state
  const [step, setStep] = useState(0);

  // Step 1 – Matter
  const [matterId, setMatterId] = useState("");
  const [matterName, setMatterName] = useState("");
  const [matterConfirmed, setMatterConfirmed] = useState(false);

  // Step 2 – Type
  const [correspondenceType, setCorrespondenceType] =
    useState<CorrespondenceType | null>(
      (initialType as CorrespondenceType) ?? null,
    );

  // Step 3 – Recipient
  const [recipientType, setRecipientType] = useState<RecipientType | null>(
    null,
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientFirm, setRecipientFirm] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Step 4 – Tone & Format
  const [tone, setTone] = useState<ToneOption | null>(null);
  const [format, setFormat] = useState<FormatOption | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  // Step 5 – Generate
  const [loadingMessage, setLoadingMessage] = useState("");

  const generateDraft = trpc.correspondence.generateDraft.useMutation({
    onSuccess(data: { id: string }) {
      onComplete(data.id);
    },
  });

  // When correspondence type changes, set sensible defaults for downstream steps
  function selectType(type: CorrespondenceType) {
    setCorrespondenceType(type);
    setRecipientType(defaultRecipientType(type));
    setTone(defaultTone(type));
    setFormat(defaultFormat(type));
  }

  // ------ Validation per step ------
  function canProceed(): boolean {
    switch (step) {
      case 0:
        return matterConfirmed && matterId.trim().length > 0;
      case 1:
        return correspondenceType !== null;
      case 2:
        return recipientType !== null;
      case 3:
        return tone !== null && format !== null;
      default:
        return true;
    }
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function handleGenerate() {
    if (!correspondenceType || !recipientType || !tone || !format) return;

    setLoadingMessage("Gathering case context...");
    setTimeout(() => setLoadingMessage("Drafting correspondence..."), 2000);

    generateDraft.mutate({
      matterId,
      correspondenceType,
      recipientType,
      recipientName: recipientName || undefined,
      recipientFirm: recipientFirm || undefined,
      tone,
      format,
      additionalInstructions: additionalInstructions || undefined,
    });
  }

  // ------ Renderers ------

  function renderProgressBar() {
    return (
      <div className="flex items-center justify-between px-2 pb-6">
        {STEPS.map((label, i) => {
          const isActive = i === step;
          const isComplete = i < step;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isComplete || isActive ? "bg-blue-500" : "bg-slate-200"
                    }`}
                  />
                )}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isComplete
                        ? "bg-blue-500 text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      isComplete ? "bg-blue-500" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[11px] leading-tight ${
                  isActive
                    ? "font-semibold text-blue-700"
                    : isComplete
                      ? "text-blue-600"
                      : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderStepMatter() {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Select Matter</h2>
        <p className="text-sm text-slate-500">
          Choose the matter this correspondence relates to.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search matters..."
            value={matterId}
            onChange={(e) => {
              setMatterId(e.target.value);
              setMatterConfirmed(false);
              setMatterName("");
            }}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            disabled={!matterId.trim()}
            onClick={() => {
              setMatterConfirmed(true);
              setMatterName(matterId.trim());
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use this matter
          </button>
        </div>

        {matterConfirmed && (
          <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <Briefcase className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {matterName}
              </p>
              <p className="text-xs text-slate-500">Matter ID: {matterId}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStepType() {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Correspondence Type
        </h2>
        <p className="text-sm text-slate-500">
          What kind of correspondence do you need?
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TYPE_CARDS.map((card) => {
            const Icon = card.icon;
            const selected = correspondenceType === card.value;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => selectType(card.value)}
                className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition ${
                  selected
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    selected ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${
                      selected ? "text-blue-700" : "text-slate-700"
                    }`}
                  >
                    {card.label}
                  </p>
                  <p className="text-xs text-slate-500">{card.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderStepRecipient() {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Recipient</h2>
        <p className="text-sm text-slate-500">
          Who is this correspondence addressed to?
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Recipient Type
            </label>
            <select
              value={recipientType ?? ""}
              onChange={(e) =>
                setRecipientType(e.target.value as RecipientType)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                Select recipient type...
              </option>
              {RECIPIENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              type="text"
              placeholder="Recipient name (optional)"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Firm
            </label>
            <input
              type="text"
              placeholder="Firm or organization (optional)"
              value={recipientFirm}
              onChange={(e) => setRecipientFirm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              placeholder="Email address (optional)"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderStepToneFormat() {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Tone</h2>
          <p className="text-sm text-slate-500">
            Set the overall tone for your correspondence.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TONE_CARDS.map((card) => {
              const Icon = card.icon;
              const selected = tone === card.value;
              return (
                <button
                  key={card.value}
                  type="button"
                  onClick={() => setTone(card.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition ${
                    selected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      selected ? "text-blue-600" : "text-slate-400"
                    }`}
                  />
                  <p
                    className={`text-sm font-medium ${
                      selected ? "text-blue-700" : "text-slate-700"
                    }`}
                  >
                    {card.label}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-500">
                    {card.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Format</h2>
          <div className="flex gap-3">
            {(
              [
                { value: "email", label: "Email" },
                { value: "letter", label: "Formal Letter" },
                { value: "filing_cover", label: "Filing Cover" },
              ] as { value: FormatOption; label: string }[]
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition ${
                  format === opt.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={() => setFormat(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Additional Instructions
          </label>
          <textarea
            rows={3}
            placeholder="Add specific details or instructions for the AI..."
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    );
  }

  function renderStepGenerate() {
    const isLoading = generateDraft.isPending;

    return (
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-slate-800">
          Review & Generate
        </h2>
        <p className="text-sm text-slate-500">
          Confirm your selections and generate the draft.
        </p>

        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <SummaryRow label="Matter" value={matterName} />
          <SummaryRow
            label="Type"
            value={correspondenceType ? typeLabel(correspondenceType) : "—"}
          />
          <SummaryRow
            label="Recipient"
            value={
              recipientType
                ? `${recipientLabel(recipientType)}${recipientName ? ` — ${recipientName}` : ""}`
                : "—"
            }
          />
          <SummaryRow label="Tone" value={tone ? toneLabel(tone) : "—"} />
          <SummaryRow
            label="Format"
            value={format ? formatLabel(format) : "—"}
          />
          {additionalInstructions && (
            <SummaryRow
              label="Instructions"
              value={additionalInstructions}
            />
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-600">
              {loadingMessage}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateDraft.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Generate Draft
          </button>
        )}

        {generateDraft.isError && (
          <p className="text-center text-sm text-red-600">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    );
  }

  // ------ Main render ------

  const stepRenderers = [
    renderStepMatter,
    renderStepType,
    renderStepRecipient,
    renderStepToneFormat,
    renderStepGenerate,
  ];

  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-800">
          New Correspondence
        </h1>
      </div>

      {/* Progress */}
      <div className="px-6 pt-5">{renderProgressBar()}</div>

      {/* Step content */}
      <div className="min-h-[320px] px-6 pb-2">{stepRenderers[step]()}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <button
          type="button"
          onClick={step === 0 ? onCancel : handleBack}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 0 ? "Cancel" : "Back"}
        </button>

        {step < STEPS.length - 1 && (
          <button
            type="button"
            disabled={!canProceed()}
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper component
// ---------------------------------------------------------------------------

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-24 shrink-0 font-medium text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
