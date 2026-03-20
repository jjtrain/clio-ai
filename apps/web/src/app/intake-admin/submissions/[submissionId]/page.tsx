"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone, Mail, User, ShieldCheck, Globe, Monitor,
  Tag, Star, MessageSquare, Ban, ArrowRightLeft, CheckCircle,
} from "lucide-react";

function qualityColor(score: number | null | undefined) {
  if (score == null) return "bg-gray-50 border-gray-200 text-gray-600";
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    new: "bg-blue-100 text-blue-700", contacted: "bg-purple-100 text-purple-700",
    converted: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700",
    spam: "bg-gray-100 text-gray-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export default function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { data: sub, refetch } = trpc.intakeForms["submissions.get"].useQuery({ submissionId });
  const updateStatus = trpc.intakeForms["submissions.updateStatus"].useMutation({ onSuccess: () => refetch() });

  if (!sub) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  const responses: Record<string, any> = typeof sub.responses === "string"
    ? JSON.parse(sub.responses) : (sub.responses ?? {});

  const setStatus = (status: string) => updateStatus.mutate({ submissionId, status });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <h1 className="text-xl font-bold">{sub.submitterName ?? "Anonymous"}</h1>
                <Badge className={statusColor(sub.status)}>{sub.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {sub.submitterEmail && (
                  <a href={`mailto:${sub.submitterEmail}`} className="flex items-center gap-1 hover:text-blue-600">
                    <Mail className="w-4 h-4" />{sub.submitterEmail}
                  </a>
                )}
                {sub.submitterPhone && (
                  <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{sub.submitterPhone}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${qualityColor(sub.qualityScore)}`}>
                <Star className="w-5 h-5" />
                <div>
                  <p className="text-xs font-medium">Quality Score</p>
                  <p className="text-2xl font-bold">{sub.qualityScore}</p>
                </div>
              </div>
              {sub.aiRecommendation && (
                <Badge variant="outline" className="text-sm py-1 px-3">
                  <MessageSquare className="w-3.5 h-3.5 mr-1" />{sub.aiRecommendation}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Responses */}
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Responses</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y">
                {Object.entries(responses).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-3">
                    <span className="text-sm font-medium text-gray-600">{key}</span>
                    <span className="text-sm text-right max-w-[60%]">{String(value)}</span>
                  </div>
                ))}
                {!Object.keys(responses).length && (
                  <p className="text-sm text-gray-500 py-2">No responses recorded.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Assessment */}
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Star className="w-4 h-4" />AI Assessment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Quality Score</span>
                <Badge className={qualityColor(sub.qualityScore)}>{sub.qualityScore}/100</Badge>
              </div>
              {sub.qualityAnalysis && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Summary</p>
                  <p className="text-sm bg-gray-50 rounded-lg p-3">{sub.qualityAnalysis}</p>
                </div>
              )}
              {sub.aiRecommendation && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Recommendation</p>
                  <p className="text-sm bg-gray-50 rounded-lg p-3">{sub.aiRecommendation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consent Records */}
          {sub.consentRecords && (
            <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Consent Records</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y">
                  {(JSON.parse(sub.consentRecords) as any[]).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">{c.type}</p>
                        <p className="text-xs text-gray-500">{c.text}</p>
                      </div>
                      <Badge variant={c.granted ? "default" : "secondary"}>
                        {c.granted ? "Granted" : "Denied"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Actions */}
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" onClick={() => setStatus("contacted")} disabled={updateStatus.isPending}>
                <CheckCircle className="w-4 h-4 mr-2" />Mark Contacted
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => setStatus("converted")} disabled={updateStatus.isPending}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />Convert to Matter
              </Button>
              <Button className="w-full justify-start text-red-600 hover:text-red-700" variant="outline" onClick={() => setStatus("rejected")} disabled={updateStatus.isPending}>
                <Ban className="w-4 h-4 mr-2" />Reject
              </Button>
              <Button className="w-full justify-start text-gray-500" variant="ghost" onClick={() => setStatus("spam")} disabled={updateStatus.isPending}>
                <Ban className="w-4 h-4 mr-2" />Mark Spam
              </Button>
            </CardContent>
          </Card>

          {/* Tracking Info */}
          <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Globe className="w-4 h-4" />Tracking Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sub.submitterIp && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">IP:</span>
                  <span className="font-mono text-xs">{sub.submitterIp}</span>
                </div>
              )}
              {sub.submitterUserAgent && (
                <div className="flex items-start gap-2 text-sm">
                  <Monitor className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-600 shrink-0">UA:</span>
                  <span className="font-mono text-xs break-all">{sub.submitterUserAgent}</span>
                </div>
              )}
              {(sub.utmSource || sub.utmMedium || sub.utmCampaign) && (
                <div className="space-y-1 pt-2 border-t">
                  <p className="text-xs font-medium text-gray-500 flex items-center gap-1"><Tag className="w-3 h-3" />UTM Parameters</p>
                  {sub.utmSource && <p className="text-xs"><span className="text-gray-500">Source:</span> {sub.utmSource}</p>}
                  {sub.utmMedium && <p className="text-xs"><span className="text-gray-500">Medium:</span> {sub.utmMedium}</p>}
                  {sub.utmCampaign && <p className="text-xs"><span className="text-gray-500">Campaign:</span> {sub.utmCampaign}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
