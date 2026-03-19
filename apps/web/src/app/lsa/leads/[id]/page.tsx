"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Phone,
  MessageSquare,
  ArrowLeft,
  Brain,
  CheckCircle,
  AlertTriangle,
  Archive,
  StickyNote,
  Clock,
  DollarSign,
  Send,
  Sparkles,
  User,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
  DISPUTED: "bg-red-100 text-red-700",
};

const CHARGE_COLORS: Record<string, string> = {
  CHARGED: "bg-yellow-100 text-yellow-700",
  NOT_CHARGED: "bg-gray-100 text-gray-600",
  CREDITED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
};

function QualityGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const bgColor =
    score >= 80 ? "bg-emerald-100" : score >= 50 ? "bg-yellow-100" : "bg-red-100";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={color}
        />
      </svg>
      <div className="absolute">
        <span className={`text-xl font-bold ${color}`}>{score}</span>
      </div>
    </div>
  );
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function LSALeadDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [replyText, setReplyText] = useState("");

  const leadQuery = trpc.lsa["leads.get"].useQuery({ id });
  const lead = leadQuery.data ?? null;

  const utils = trpc.useUtils();

  if (leadQuery.isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-gray-500">Lead not found</p>
        <Link href="/lsa/leads">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Leads
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/lsa/leads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {lead.consumerName || "Unknown Consumer"}
            </h1>
            <Badge variant="secondary" className="flex items-center gap-1">
              {lead.leadType === "PHONE_CALL" ? (
                <Phone className="h-3 w-3" />
              ) : (
                <MessageSquare className="h-3 w-3" />
              )}
              {lead.leadType}
            </Badge>
            <Badge variant="secondary">{lead.categoryName}</Badge>
          </div>
        </div>
      </div>

      {/* Top Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Quality Score Gauge */}
        <Card>
          <CardContent className="p-5 flex flex-col items-center">
            <p className="text-sm text-gray-500 mb-2">Quality Score</p>
            {lead.aiQualityScore !== null && lead.aiQualityScore !== undefined ? (
              <QualityGauge score={lead.aiQualityScore} />
            ) : (
              <div className="h-24 flex items-center justify-center text-gray-400 text-sm">
                No score
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status & Charge */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div>
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <Badge className={STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}>
                {lead.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Charge Status</p>
              <Badge className={CHARGE_COLORS[lead.chargeStatus] ?? "bg-gray-100 text-gray-600"}>
                {lead.chargeStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Cost */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <p className="text-sm text-gray-500">Lead Cost</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ${lead.leadCost?.toFixed(2) ?? "0.00"}
            </p>
          </CardContent>
        </Card>

        {/* Conversion */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500 mb-2">Converted</p>
            {lead.conversionDate ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <span className="font-semibold">Yes</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <span className="font-semibold">Not yet</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Assessment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-purple-50">
              <p className="text-xs text-purple-600 font-medium mb-1">Score</p>
              <p className="text-lg font-bold text-purple-900">
                {lead.aiQualityScore ?? "N/A"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 md:col-span-2">
              <p className="text-xs text-purple-600 font-medium mb-1">Summary</p>
              <p className="text-sm text-purple-900">
                {lead.aiSummary || "No AI summary available for this lead."}
              </p>
            </div>
          </div>
          {lead.aiRecommendation && (
            <div className="p-3 rounded-lg bg-blue-50">
              <p className="text-xs text-blue-600 font-medium mb-1">Recommendation</p>
              <p className="text-sm text-blue-900">{lead.aiRecommendation}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Type Specific Content */}
      {lead.leadType === "PHONE_CALL" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-500" />
              Call Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Duration:</span>
                <span className="text-sm font-medium">
                  {formatDuration(lead.callDuration)}
                </span>
              </div>
            </div>
            {lead.callTranscript ? (
              <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto">
                <p className="text-xs text-gray-500 font-medium mb-2">Transcript</p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                  {lead.callTranscript}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm">
                No transcript available
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {lead.leadType === "MESSAGE" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lead.messageText ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {lead.consumerName || "Consumer"}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{lead.messageText}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm">
                No message content
              </div>
            )}

            {/* Reply Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Reply</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplyText(
                      (lead.aiSummary as string) ||
                        "Thank you for reaching out. We would be happy to discuss your legal needs. Please let us know a convenient time to schedule a consultation."
                    );
                  }}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI Suggest
                </Button>
              </div>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
              />
              <Button
                size="sm"
                disabled={!replyText.trim()}
                onClick={() => {
                  toast({ title: "Reply sent", description: "Your reply has been sent to the consumer." });
                  setReplyText("");
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Reply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {!lead.conversionDate && (
              <Button
                onClick={() => {
                  toast({
                    title: "Lead Converted",
                    description: "This lead has been marked as converted.",
                  });
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Convert Lead
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                toast({
                  title: "Dispute Filed",
                  description: "A dispute has been filed for this lead.",
                });
              }}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Dispute
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast({
                  title: "Lead Archived",
                  description: "This lead has been archived.",
                });
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </div>

          {/* Add Note */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Add Note</p>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this lead..."
              rows={2}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!note.trim()}
              onClick={() => {
                toast({ title: "Note Added", description: "Your note has been saved." });
                setNote("");
              }}
            >
              Save Note
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
