"use client";

import IntakeHub from "@/components/intake-screening/IntakeHub";
import { MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function IntakeScreeningPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-6xl mx-auto">
        <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
          <Link href="/" className="hover:text-slate-700 transition-colors">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium">AI Intake Screening</span>
        </nav>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Intake Screening</h1>
            <p className="text-sm text-slate-500">
              AI-powered chatbot intake with lead scoring, attorney routing, and conversion to matters
            </p>
          </div>
        </div>

        <IntakeHub />
      </div>
    </div>
  );
}
