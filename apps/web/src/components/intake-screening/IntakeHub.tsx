"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users,
  TrendingUp,
  Clock,
  ChevronRight,
  Phone,
  Mail,
  AlertTriangle,
  Zap,
  Filter,
  MessageSquare,
  Star,
  Archive,
} from "lucide-react";
import { IntakeSessionDetail } from "./IntakeSessionDetail";

type View = "hub" | "detail";

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-green-100", text: "text-green-700" },
  B: { bg: "bg-blue-100", text: "text-blue-700" },
  C: { bg: "bg-yellow-100", text: "text-yellow-700" },
  D: { bg: "bg-orange-100", text: "text-orange-700" },
  F: { bg: "bg-red-100", text: "text-red-700" },
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-600",
  qualified: "bg-blue-100 text-blue-700",
  disqualified: "bg-red-100 text-red-700",
  converted: "bg-purple-100 text-purple-700",
  needs_review: "bg-yellow-100 text-yellow-700",
  archived: "bg-slate-100 text-slate-500",
  abandoned: "bg-slate-100 text-slate-400",
};

const URGENCY_STYLES: Record<string, string> = {
  emergency: "bg-red-500 text-white animate-pulse",
  urgent: "bg-orange-500 text-white",
};

const SOURCE_LABELS: Record<string, string> = {
  website_widget: "Website",
  google_ads: "Google Ads",
  facebook: "Facebook",
  referral: "Referral",
  phone: "Phone",
  email: "Email",
  direct_link: "Direct",
};

export default function IntakeHub() {
  const [view, setView] = useState<View>("hub");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [practiceFilter, setPracticeFilter] = useState<string>("");

  const statsQuery = trpc.intakeScreening.getDashboardStats.useQuery();
  const sessionsQuery = trpc.intakeScreening.getSessions.useQuery({
    status: statusFilter || undefined,
    leadGrade: gradeFilter || undefined,
    practiceArea: practiceFilter || undefined,
  });
  const funnelQuery = trpc.intakeScreening.getConversionFunnel.useQuery({ days: 30 });

  const stats = statsQuery.data;
  const sessions = sessionsQuery.data ?? [];
  const funnel = funnelQuery.data;

  if (view === "detail" && selectedSessionId) {
    return (
      <IntakeSessionDetail
        sessionId={selectedSessionId}
        onBack={() => { setSelectedSessionId(null); setView("hub"); sessionsQuery.refetch(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Today&apos;s Leads</p>
          <p className="text-2xl font-bold text-slate-900">{stats?.thisWeekSessions ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Qualified This Week</p>
          <p className="text-2xl font-bold text-green-600">{stats?.qualifiedThisWeek ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Converted</p>
          <p className="text-2xl font-bold text-purple-600">{stats?.totalConverted ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Conversion Rate</p>
          <p className="text-2xl font-bold text-slate-900">
            {funnel && funnel.started > 0 ? Math.round((funnel.converted / funnel.started) * 100) : 0}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Active Now</p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-2xl font-bold text-slate-900">{stats?.activeSessions ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Funnel mini-bar */}
      {funnel && funnel.started > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">30-Day Conversion Funnel</p>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1">
              <div className="h-6 rounded bg-slate-200">
                <div className="h-6 rounded bg-slate-400 flex items-center px-2 text-white font-medium" style={{ width: "100%" }}>
                  {funnel.started} started
                </div>
              </div>
            </div>
            <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-6 rounded bg-blue-100">
                <div className="h-6 rounded bg-blue-500 flex items-center px-2 text-white font-medium"
                  style={{ width: `${Math.max(20, (funnel.completed / funnel.started) * 100)}%` }}>
                  {funnel.completed}
                </div>
              </div>
            </div>
            <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-6 rounded bg-green-100">
                <div className="h-6 rounded bg-green-500 flex items-center px-2 text-white font-medium"
                  style={{ width: `${Math.max(20, (funnel.qualified / funnel.started) * 100)}%` }}>
                  {funnel.qualified}
                </div>
              </div>
            </div>
            <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-6 rounded bg-purple-100">
                <div className="h-6 rounded bg-purple-500 flex items-center px-2 text-white font-medium"
                  style={{ width: `${Math.max(20, (funnel.converted / funnel.started) * 100)}%` }}>
                  {funnel.converted}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-slate-900">Lead Queue</h2>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="qualified">Qualified</option>
          <option value="needs_review">Needs Review</option>
          <option value="converted">Converted</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          <option value="">All Grades</option>
          <option value="A">A — Hot</option>
          <option value="B">B — Warm</option>
          <option value="C">C — Cool</option>
          <option value="D">D — Unqualified</option>
        </select>
        <select value={practiceFilter} onChange={(e) => setPracticeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
          <option value="">All Practice Areas</option>
          <option value="personal_injury">Personal Injury</option>
          <option value="family_law">Family Law</option>
          <option value="immigration">Immigration</option>
          <option value="corporate">Corporate</option>
          <option value="general">General</option>
        </select>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">No intake sessions yet</h3>
            <p className="mt-1 text-sm text-slate-500">Sessions will appear here when leads interact with the intake widget.</p>
          </div>
        ) : (
          sessions.map((session: any) => {
            const gradeStyle = GRADE_STYLES[session.leadGrade] || GRADE_STYLES.C;
            const statusStyle = STATUS_STYLES[session.status] || STATUS_STYLES.completed;
            const contact = session.contactInfo || {};
            const name = contact.firstName ? `${contact.firstName} ${contact.lastName || ""}`.trim() : contact.fullName || "Anonymous";

            return (
              <button
                key={session.id}
                onClick={() => { setSelectedSessionId(session.id); setView("detail"); }}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="flex items-center gap-4">
                  {/* Grade */}
                  {session.leadGrade && (
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold ${gradeStyle.bg} ${gradeStyle.text}`}>
                      {session.leadGrade}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-900">{name}</span>
                      {contact.phone && <Phone className="h-3 w-3 text-slate-400" />}
                      {contact.email && <Mail className="h-3 w-3 text-slate-400" />}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}>
                        {session.status === "needs_review" ? "Needs Review" : session.status}
                      </span>
                      {session.urgencyLevel && URGENCY_STYLES[session.urgencyLevel] && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${URGENCY_STYLES[session.urgencyLevel]}`}>
                          {session.urgencyLevel.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {session.practiceArea && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {session.practiceArea.replace(/_/g, " ")}
                        </span>
                      )}
                      {session.source && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
                          {SOURCE_LABELS[session.source] || session.source}
                        </span>
                      )}
                      {session.leadScore && (
                        <span className="font-medium">{session.leadScore}/100</span>
                      )}
                      {session.assignedToName && (
                        <span className="text-slate-400">→ {session.assignedToName}</span>
                      )}
                      <span className="text-slate-400">
                        {timeAgo(session.createdAt)}
                      </span>
                    </div>
                    {session.aiSummary && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                        {session.aiSummary.replace(/\*\*/g, "").substring(0, 120)}...
                      </p>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
