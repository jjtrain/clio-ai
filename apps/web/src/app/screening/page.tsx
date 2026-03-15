"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScanSearch,
  Settings,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  Plus,
  Mail,
  ListChecks,
  Bell,
  ArrowUpDown,
  Calendar,
  Send,
  Briefcase,
  Ban,
} from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-700 border-green-300",
  B: "bg-blue-100 text-blue-700 border-blue-300",
  C: "bg-amber-100 text-amber-700 border-amber-300",
  D: "bg-orange-100 text-orange-700 border-orange-300",
  F: "bg-red-100 text-red-700 border-red-300",
};

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 animate-pulse",
  HIGH: "bg-red-50 text-red-600",
  MEDIUM: "bg-amber-50 text-amber-600",
  LOW: "bg-gray-100 text-gray-500",
};

const EXEC_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const ACTION_TYPE_ICONS: Record<string, any> = {
  EMAIL: Mail,
  TASK: ListChecks,
  STATUS_CHANGE: ArrowUpDown,
  NOTIFICATION: Bell,
};

const TRIGGER_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  LEAD_QUALIFIED: "Lead Qualified",
  CONSULTATION_COMPLETED: "Consultation Done",
  NO_RESPONSE: "No Response",
  INTAKE_SUBMITTED: "Intake Submitted",
  CUSTOM: "Custom",
};

export default function ScreeningDashboard() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"queue" | "sequences" | "log">("queue");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [urgencyFilter, setUrgencyFilter] = useState("ALL");
  const [execStatusFilter, setExecStatusFilter] = useState("ALL");

  const { data: qualifications, refetch: refetchQuals } = trpc.screening.listQualifications.useQuery(
    gradeFilter !== "ALL" || urgencyFilter !== "ALL"
      ? {
          grade: gradeFilter !== "ALL" ? (gradeFilter as any) : undefined,
          urgency: urgencyFilter !== "ALL" ? (urgencyFilter as any) : undefined,
        }
      : undefined
  );
  const { data: sequences } = trpc.screening.listSequences.useQuery();
  const { data: executions } = trpc.screening.listExecutions.useQuery(
    execStatusFilter !== "ALL" ? { status: execStatusFilter as any } : undefined
  );

  const batchScreen = trpc.screening.batchScreen.useMutation({
    onSuccess: (r) => { toast({ title: `Screened ${r.processed} leads` }); refetchQuals(); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleSequence = trpc.screening.updateSequence.useMutation({
    onSuccess: () => toast({ title: "Sequence updated" }),
  });

  // Grade counts
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  qualifications?.forEach((q: any) => { if (gradeCounts[q.grade as keyof typeof gradeCounts] !== undefined) gradeCounts[q.grade as keyof typeof gradeCounts]++; });

  const tabs = [
    { id: "queue", label: "Screening Queue" },
    { id: "sequences", label: "Follow-up Sequences" },
    { id: "log", label: "Execution Log" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScanSearch className="h-7 w-7 text-rose-600" />
          <h1 className="text-2xl font-semibold">Intake Screening & Follow-up</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => batchScreen.mutate()} disabled={batchScreen.isPending}>
            <Sparkles className="h-4 w-4 mr-2" /> {batchScreen.isPending ? "Screening..." : "Screen All Unscreened"}
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/screening/settings"><Settings className="h-5 w-5" /></Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-rose-500 text-rose-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Screening Queue Tab */}
      {tab === "queue" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-3">
            {(["A", "B", "C", "D", "F"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(gradeFilter === g ? "ALL" : g)}
                className={`p-4 rounded-xl border text-center transition-all ${
                  gradeFilter === g ? "ring-2 ring-rose-500" : ""
                } ${GRADE_COLORS[g]}`}
              >
                <div className="text-3xl font-bold">{gradeCounts[g]}</div>
                <div className="text-sm font-medium">Grade {g}</div>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Urgency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Urgency</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Qualifications Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {!qualifications?.length ? (
              <div className="p-12 text-center">
                <ScanSearch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No screened leads yet</h3>
                <p className="text-gray-500">Click "Screen All Unscreened" to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {qualifications.map((q: any) => {
                  const isExpanded = expandedRow === q.id;
                  const redFlags = q.redFlags ? JSON.parse(q.redFlags) : [];
                  const strengths = q.strengths ? JSON.parse(q.strengths) : [];
                  const scoreColor = q.score >= 80 ? "bg-green-500" : q.score >= 60 ? "bg-blue-500" : q.score >= 40 ? "bg-amber-500" : q.score >= 20 ? "bg-orange-500" : "bg-red-500";

                  return (
                    <div key={q.id}>
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : q.id)}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 text-left"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{q.lead?.name}</p>
                          <p className="text-xs text-gray-500">{q.lead?.email || "No email"}</p>
                        </div>

                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {q.lead?.source}
                        </span>

                        <span className={`text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center border ${GRADE_COLORS[q.grade]}`}>
                          {q.grade}
                        </span>

                        <div className="w-24">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{q.score}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${q.score}%` }} />
                          </div>
                        </div>

                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${URGENCY_COLORS[q.urgencyLevel]}`}>
                          {q.urgencyLevel}
                        </span>

                        {q.practiceAreaMatch ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300 shrink-0" />
                        )}

                        <span className="text-xs text-gray-500 w-32 truncate">{q.recommendedAction}</span>

                        <span className="text-xs text-gray-400 w-20">
                          {new Date(q.screenedAt).toLocaleDateString()}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-12 pb-6 space-y-4 bg-gray-50/50">
                          {/* AI Analysis */}
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">AI Analysis</h4>
                            <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: q.aiAnalysis }} />
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Red Flags */}
                            {redFlags.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-red-600 uppercase mb-2">Red Flags</h4>
                                <div className="flex flex-wrap gap-1">
                                  {redFlags.map((f: string, i: number) => (
                                    <span key={i} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full border border-red-200">{f}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Strengths */}
                            {strengths.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-green-600 uppercase mb-2">Strengths</h4>
                                <div className="flex flex-wrap gap-1">
                                  {strengths.map((s: string, i: number) => (
                                    <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200">{s}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {q.estimatedValue && (
                            <p className="text-sm"><strong>Estimated Value:</strong> ${Number(q.estimatedValue).toLocaleString()}</p>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href="/calendar"><Calendar className="h-3 w-3 mr-1" /> Schedule Consultation</Link>
                            </Button>
                            <Button size="sm" variant="outline">
                              <Send className="h-3 w-3 mr-1" /> Send Follow-up
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/leads`}><Briefcase className="h-3 w-3 mr-1" /> View in Pipeline</Link>
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                              <Ban className="h-3 w-3 mr-1" /> Decline
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Follow-up Sequences Tab */}
      {tab === "sequences" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild className="bg-rose-600 hover:bg-rose-700">
              <Link href="/screening/sequences/new"><Plus className="h-4 w-4 mr-2" /> New Sequence</Link>
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {!sequences?.length ? (
              <div className="p-12 text-center text-gray-500">No follow-up sequences</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sequences.map((seq: any) => (
                  <div key={seq.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <Link href={`/screening/sequences/${seq.id}`} className="font-medium text-sm hover:text-rose-600">
                        {seq.name}
                      </Link>
                      {seq.description && <p className="text-xs text-gray-500 line-clamp-1">{seq.description}</p>}
                    </div>

                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {TRIGGER_LABELS[seq.triggerEvent] || seq.triggerEvent}
                    </span>

                    <span className="text-xs text-gray-500">{seq._count?.steps || 0} steps</span>

                    <span className="text-xs text-gray-500">{seq.executions?.length || 0} active</span>

                    <button
                      onClick={() => toggleSequence.mutate({ id: seq.id, isActive: !seq.isActive })}
                      className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                        seq.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {seq.isActive ? "Active" : "Inactive"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Execution Log Tab */}
      {tab === "log" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Select value={execStatusFilter} onValueChange={setExecStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {!executions?.length ? (
              <div className="p-12 text-center text-gray-500">No execution history</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium">Lead</th>
                    <th className="text-left px-4 py-3 font-medium">Sequence</th>
                    <th className="text-center px-4 py-3 font-medium">Step</th>
                    <th className="text-center px-4 py-3 font-medium">Action</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Scheduled</th>
                    <th className="text-left px-4 py-3 font-medium">Executed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {executions.map((ex: any) => {
                    const ActionIcon = ACTION_TYPE_ICONS[ex.step?.actionType] || Bell;
                    return (
                      <tr key={ex.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <p className="font-medium">{ex.lead?.name}</p>
                          <p className="text-xs text-gray-400">{ex.lead?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{ex.sequence?.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium">
                            {ex.step?.stepNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ActionIcon className="h-4 w-4 mx-auto text-gray-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${EXEC_STATUS_COLORS[ex.status]}`}>
                            {ex.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(ex.scheduledFor).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {ex.executedAt ? new Date(ex.executedAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
