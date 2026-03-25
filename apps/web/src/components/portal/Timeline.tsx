"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface TimelineStep {
  label: string;
  status: "complete" | "active" | "upcoming";
  date?: string;
}

export function MatterTimeline({ steps }: { steps: TimelineStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <>
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-start gap-0 w-full">
        {steps.map((step, i) => (
          <div key={i} className="flex-1 flex flex-col items-center text-center relative">
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={cn("absolute top-3 left-1/2 w-full h-0.5", step.status === "complete" ? "bg-[#1AA8A0]" : "bg-gray-200")} />
            )}
            {/* Dot */}
            <div className={cn("relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all",
              step.status === "complete" ? "bg-[#1AA8A0] border-[#1AA8A0]"
              : step.status === "active" ? "bg-white border-[#1AA8A0] ring-4 ring-[#1AA8A0]/20"
              : "bg-gray-100 border-gray-300"
            )}>
              {step.status === "complete" && <Check className="h-3.5 w-3.5 text-white" />}
              {step.status === "active" && <div className="w-2 h-2 rounded-full bg-[#1AA8A0]" />}
            </div>
            {/* Label */}
            <p className={cn("mt-2 text-[12px] leading-tight max-w-[100px]",
              step.status === "active" ? "font-medium text-foreground" : step.status === "complete" ? "text-muted-foreground" : "text-muted-foreground/60"
            )}>{step.label}</p>
            {step.date && step.status === "complete" && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{step.date}</p>}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="md:hidden space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center border-2 flex-shrink-0",
                step.status === "complete" ? "bg-[#1AA8A0] border-[#1AA8A0]"
                : step.status === "active" ? "bg-white border-[#1AA8A0] ring-2 ring-[#1AA8A0]/20"
                : "bg-gray-100 border-gray-200"
              )}>
                {step.status === "complete" && <Check className="h-3 w-3 text-white" />}
                {step.status === "active" && <div className="w-1.5 h-1.5 rounded-full bg-[#1AA8A0]" />}
              </div>
              {i < steps.length - 1 && <div className={cn("w-0.5 flex-1 min-h-[24px]", step.status === "complete" ? "bg-[#1AA8A0]" : "bg-gray-200")} />}
            </div>
            <div className="pb-4">
              <p className={cn("text-[13px]", step.status === "active" ? "font-medium text-foreground" : step.status === "complete" ? "text-muted-foreground" : "text-muted-foreground/60")}>{step.label}</p>
              {step.date && step.status === "complete" && <p className="text-[10px] text-muted-foreground/50">{step.date}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
