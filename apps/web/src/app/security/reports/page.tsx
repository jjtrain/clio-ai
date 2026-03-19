"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  ShieldCheck,
  ClipboardList,
  Scale,
  Users,
  AlertTriangle,
  KeyRound,
  Tags,
  Building2,
  FileDown,
} from "lucide-react";

const reports = [
  {
    id: "security-posture",
    title: "Security Posture",
    description: "Comprehensive overview of your organization's security status, controls, and risk exposure.",
    icon: ShieldCheck,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    id: "audit-summary",
    title: "Audit Summary",
    description: "Summary of recent audit events, findings, and remediation status across all systems.",
    icon: ClipboardList,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    id: "compliance-status",
    title: "Compliance Status",
    description: "Current compliance posture across regulatory frameworks including SOC 2, HIPAA, and ABA guidelines.",
    icon: Scale,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    id: "access-review",
    title: "Access Review",
    description: "Review of user access rights, privilege escalations, and policy compliance.",
    icon: Users,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    id: "incident-summary",
    title: "Incident Summary",
    description: "Overview of security incidents, response times, and resolution metrics.",
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    id: "encryption-health",
    title: "Encryption Health",
    description: "Status of encryption keys, rotation schedules, and cryptographic algorithm compliance.",
    icon: KeyRound,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    id: "data-governance",
    title: "Data Governance",
    description: "Data classification coverage, retention policy compliance, and legal hold status.",
    icon: Tags,
    color: "text-teal-600",
    bg: "bg-teal-50",
  },
  {
    id: "vendor-risk",
    title: "Vendor Risk",
    description: "Third-party vendor risk assessments, certification status, and BAA compliance.",
    icon: Building2,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

export default function SecurityReportsPage() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = (reportId: string) => {
    setGenerating(reportId);
    toast({ title: "Report generating", description: `Generating ${reportId} report...` });
    setTimeout(() => setGenerating(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Security Reports</h1>
        <p className="text-gray-500 mt-1">Generate and download security and compliance reports</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          const isGenerating = generating === report.id;
          return (
            <div key={report.id} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col">
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-3 rounded-lg ${report.bg} shrink-0`}>
                  <Icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{report.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleGenerate(report.id)}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-3.5 w-3.5 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
