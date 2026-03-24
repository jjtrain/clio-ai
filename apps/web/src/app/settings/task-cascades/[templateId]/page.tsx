"use client";
import { useParams } from "next/navigation";
import { CascadeTemplateDetail } from "@/components/cascade/CascadeTemplateDetail";
export default function CascadeTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  return <div className="p-6 max-w-4xl mx-auto"><CascadeTemplateDetail templateId={templateId} /></div>;
}
