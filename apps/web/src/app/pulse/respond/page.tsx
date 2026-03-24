"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PulseResponsePage } from "@/components/pulse/PulseResponsePage";

function RespondContent() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const score = params.get("score") ? parseInt(params.get("score")!, 10) : undefined;

  return <PulseResponsePage token={token} initialScore={score} />;
}

export default function PulseRespondPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <RespondContent />
    </Suspense>
  );
}
