"use client";

import { Briefcase, Shield, Heart, AlarmClock, Gavel } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ToneSelectorProps {
  value: string;
  onChange: (tone: string) => void;
}

interface ToneOption {
  id: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  iconColor: string;
}

const TONE_OPTIONS: ToneOption[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Balanced and business-like",
    Icon: Briefcase,
    iconColor: "text-blue-600",
  },
  {
    id: "firm",
    label: "Firm",
    description: "Assertive and direct",
    Icon: Shield,
    iconColor: "text-red-600",
  },
  {
    id: "cordial",
    label: "Cordial",
    description: "Warm and relationship-building",
    Icon: Heart,
    iconColor: "text-pink-500",
  },
  {
    id: "urgent",
    label: "Urgent",
    description: "Time-sensitive and action-requiring",
    Icon: AlarmClock,
    iconColor: "text-amber-600",
  },
  {
    id: "sympathetic",
    label: "Sympathetic",
    description: "Understanding and supportive",
    Icon: Heart,
    iconColor: "text-purple-500",
  },
  {
    id: "formal_court",
    label: "Formal Court",
    description: "Strict judicial conventions",
    Icon: Gavel,
    iconColor: "text-slate-700",
  },
];

export default function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {TONE_OPTIONS.map(({ id, label, description, Icon, iconColor }) => {
        const isSelected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors ${
              isSelected
                ? "border-blue-600 bg-blue-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <div>
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
