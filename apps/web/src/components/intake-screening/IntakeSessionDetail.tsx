"use client";

import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Phone,
  Mail,
  Check,
  Clock,
  AlertTriangle,
  Shield,
  FileText,
  Star,
  MessageSquare,
  Copy,
  ArrowRight,
} from "lucide-react";

interface IntakeSessionDetailProps {
  sessionId: string;
  onBack: () => void;
}

const GRADE_STYLES: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-green-100", text: "text-green-700" },
  B: { bg: "bg-blue-100", text: "text-blue-700" },
  C: { bg: "bg-yellow-100", text: "text-yellow-700" },
  D: { bg: "bg-orange-100", text: "text-orange-700" },
  F: { bg: "bg-red-100", text: "text-red-700" },
};

export function IntakeSessionDetail({ sessionId, onBack }: IntakeSessionDetailProps) {
  const sessionQuery = trpc.intakeScreening.getSession.useQuery({ sessionId });
  const markContactedMut = trpc.intakeScreening.markContacted.useMutation({
    onSuccess: () => sessionQuery.refetch(),
  });
  const convertMut = trpc.intakeScreening.convertToMatter.useMutation({
    onSuccess: () => sessionQuery.refetch(),
  });
  const archiveMut = trpc.intakeScreening.archiveSession.useMutation({
    onSuccess: () => sessionQuery.refetch(),
  });

  const session = sessionQuery.data as any;
  if (!session) {
    return <div className="flex justify-center py-20"><Clock className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  const contact = session.contactInfo || session.extractedData?.contactInfo || {};
  const extracted = session.extractedData || {};
  const scoring = session.scoringBreakdown || [];
  const conversation = session.conversationLog || [];
  const gradeStyle = GRADE_STYLES[session.leadGrade] || GRADE_STYLES.C;
  const name = contact.firstName ? `${contact.firstName} ${contact.lastName || ""}`.trim() : contact.fullName || "Lead";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
              {session.leadGrade && (
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${gradeStyle.bg} ${gradeStyle.text}`}>
                  {session.leadGrade}
                </span>
              )}
              {session.leadScore && (
                <span className="text-sm font-medium text-slate-500">{session.leadScore}/100</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {session.practiceArea && <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{session.practiceArea.replace(/_/g, " ")}</span>}
              <span className="rounded bg-slate-100 px-2 py-0.5">{session.status}</span>
              {session.urgencyLevel !== "normal" && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-700 font-semibold">{session.urgencyLevel.toUpperCase()}</span>
              )}
              {session.assignedToName && <span>Assigned: {session.assignedToName}</span>}
              {session.source && <span>Source: {session.source}</span>}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!session.contactedAt && contact.phone && (
            <button
              onClick={() => markContactedMut.mutate({ sessionId, contactMethod: "phone" })}
              disabled={markContactedMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Phone className="h-3.5 w-3.5" />
              Contact
            </button>
          )}
          {session.status === "qualified" && (
            <button
              onClick={() => convertMut.mutate({ sessionId })}
              disabled={convertMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              {convertMut.isPending ? "Converting..." : "Convert to Matter"}
            </button>
          )}
          <button
            onClick={() => archiveMut.mutate({ sessionId })}
            disabled={archiveMut.isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Archive
          </button>
        </div>
      </div>

      {convertMut.isSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          Matter created successfully! The intake data has been converted.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Summary + Scoring + Extracted */}
        <div className="space-y-5 lg:col-span-2">
          {/* AI Summary */}
          {session.aiSummary && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Star className="h-4 w-4 text-purple-500" />
                  AI Summary
                </h3>
                <button
                  onClick={() => navigator.clipboard.writeText(session.aiSummary)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {session.aiSummary}
              </div>
            </div>
          )}

          {/* Scoring Breakdown */}
          {scoring.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Scoring Breakdown</h3>
              <div className="space-y-2">
                {scoring.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-slate-900">{f.factor}</span>
                      <span className="ml-2 text-xs text-slate-500">{f.description}</span>
                    </div>
                    <span className={`text-sm font-bold ${f.points > 0 ? "text-green-600" : f.points < 0 ? "text-red-600" : "text-slate-500"}`}>
                      {f.points > 0 ? "+" : ""}{f.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Transcript */}
          {conversation.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                Conversation ({conversation.length} messages)
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {conversation.map((msg: any, i: number) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {msg.content}
                      <p className="mt-1 text-[10px] opacity-50">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Contact + Extracted Data */}
        <div className="space-y-5">
          {/* Contact Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Contact Information</h3>
            <div className="space-y-2 text-sm">
              {(contact.firstName || contact.fullName) && (
                <div><span className="text-slate-500">Name:</span> <span className="font-medium text-slate-900">{contact.firstName ? `${contact.firstName} ${contact.lastName || ""}` : contact.fullName}</span></div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
                </div>
              )}
              {contact.bestTimeToCall && (
                <div><span className="text-slate-500">Best time:</span> {contact.bestTimeToCall}</div>
              )}
            </div>
            {session.contactedAt && (
              <div className="mt-3 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Contacted via {session.contactMethod} on {new Date(session.contactedAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Extracted Data */}
          {Object.keys(extracted).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Extracted Data</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(extracted).filter(([k]) => k !== "contactInfo").map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="text-slate-500 text-xs">{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}</span>
                    <span className="font-medium text-slate-900 text-xs text-right">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflict Check */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              Conflict Check
            </h3>
            {session.conflictCheckStatus === "potential_conflict" ? (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                <p className="text-xs text-red-700 font-medium">Potential conflict detected</p>
                {session.conflictDetails && <p className="text-xs text-red-600 mt-1">{session.conflictDetails}</p>}
              </div>
            ) : (
              <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {session.conflictCheckStatus === "clear" ? "No conflicts detected" : "Not yet checked"}
                </p>
              </div>
            )}
          </div>

          {/* Session Meta */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Session Details</h3>
            <div className="space-y-1 text-xs text-slate-500">
              <p>Messages: {session.messagesCount}</p>
              <p>Source: {session.source}</p>
              {session.referrerUrl && <p>Referrer: {session.referrerUrl}</p>}
              <p>Started: {new Date(session.createdAt).toLocaleString()}</p>
              {session.completedAt && <p>Completed: {new Date(session.completedAt).toLocaleString()}</p>}
              {session.convertedMatterId && <p>Matter: <a href={`/matters/${session.convertedMatterId}`} className="text-blue-600 hover:underline">{session.convertedMatterId}</a></p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
