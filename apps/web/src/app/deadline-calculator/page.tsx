"use client";

import SmartDeadlineCalculator from "@/components/deadline-calculator/SmartDeadlineCalculator";
import { Calculator, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function DeadlineCalculatorPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
          <Link href="/" className="hover:text-slate-700 transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 font-medium">Deadline Calculator</span>
        </nav>

        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
            <Calculator className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Smart Deadline Calculator
            </h1>
            <p className="text-sm text-slate-500">
              Calculate litigation deadlines from trigger events with AI-powered parsing
            </p>
          </div>
        </div>

        <SmartDeadlineCalculator />
      </div>
    </div>
  );
}
