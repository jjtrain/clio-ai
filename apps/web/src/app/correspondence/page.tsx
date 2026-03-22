"use client";

import CorrespondenceHub from "@/components/correspondence/CorrespondenceHub";
import { Sparkles } from "lucide-react";

export default function CorrespondencePage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-bold">AI Correspondence</h1>
      </div>
      <CorrespondenceHub />
    </div>
  );
}
