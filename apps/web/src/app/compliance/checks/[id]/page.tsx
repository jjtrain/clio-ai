"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, ShieldCheck, ShieldAlert, AlertTriangle, AlertCircle, CheckCircle,
  XCircle, Clock, FileText, Users, Copy, RefreshCw, Send, Eye, Ban,
} from "lucide-react";

const RISK_COLORS: Record<string, string> = { LOW: "bg-emerald-100 text-emerald-700 border-emerald-300", MEDIUM: "bg-blue-100 text-blue-700 border-blue-300", HIGH: "bg-amber-100 text-amber-700 border-amber-300", VERY_HIGH: "bg-red-100 text-red-700 border-red-300" };
const STATUS_COLORS: Record<string, string> = { NOT_STARTED: "bg-gray-100 text-gray-700", PENDING_CLIENT: "bg-amber-100 text-amber-700", IN_PROGRESS: "bg-blue-100 text-blue-700", AWAITING_DOCUMENTS: "bg-purple-100 text-purple-700", UNDER_REVIEW: "bg-indigo-100 text-indigo-700", PASSED: "bg-emerald-100 text-emerald-700", FAILED: "bg-red-100 text-red-700", REFERRED: "bg-orange-100 text-orange-700", EXPIRED: "bg-gray-100 text-gray-500", CANCELLED: "bg-gray-100 text-gray-400" };
const MATCH_COLORS: Record<string, string> = { CLEAR: "text-emerald-600", POTENTIAL_MATCH: "text-amber-600", CONFIRMED_MATCH: "text-red-600" };
const DOC_STATUS: Record<string, string> = { PENDING: "bg-gray-100 text-gray-600", SUBMITTED: "bg-blue-100 text-blue-700", UNDER_REVIEW: "bg-purple-100 text-purple-700", VERIFIED: "bg-emerald-100 text-emerald-700", REJECTED: "bg-red-100 text-red-700", EXPIRED: "bg-gray-100 text-gray-500" };

export default function CheckDetailPage() {
  const { id } = useParams() as { id: string };
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [decisionNotes, setDecisionNotes] = useState("");

  const { data: check, isLoading } = trpc.compliance["checks.get"].useQuery({ id });
  const approveMut = trpc.compliance["checks.approve"].useMutation({ onSuccess: () => { utils.compliance["checks.get"].invalidate({ id }); toast({ title: "Check approved" }); } });
  const rejectMut = trpc.compliance["checks.reject"].useMutation({ onSuccess: () => { utils.compliance["checks.get"].invalidate({ id }); toast({ title: "Check rejected" }); } });
  const referMut = trpc.compliance["checks.refer"].useMutation({ onSuccess: () => { utils.compliance["checks.get"].invalidate({ id }); toast({ title: "Referred for EDD" }); } });
  const narrativeMut = trpc.compliance["checks.generateRiskNarrative"].useMutation({ onSuccess: () => { utils.compliance["checks.get"].invalidate({ id }); toast({ title: "Narrative generated" }); } });
  const resendMut = trpc.compliance["checks.resendNotification"].useMutation({ onSuccess: () => toast({ title: "Notification resent" }) });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!check) return <p className="text-center py-12 text-gray-400">Check not found.</p>;

  const sanctionsMatches = check.sanctionsMatches ? JSON.parse(check.sanctionsMatches) : [];
  const pepMatches = check.pepMatches ? JSON.parse(check.pepMatches) : [];
  const adverseMediaMatches = check.adverseMediaMatches ? JSON.parse(check.adverseMediaMatches) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{check.subjectName}</h1>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[check.status]}`}>{check.status.replace(/_/g, " ")}</span>
            {check.overallRiskLevel && <span className={`text-xs px-3 py-1 rounded-full border font-medium ${RISK_COLORS[check.overallRiskLevel]}`}>{check.overallRiskLevel} RISK{check.riskScore ? ` (${check.riskScore})` : ""}</span>}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{check.subjectType}</span>
            <span>{check.checkType}</span>
            {check.client && <Link href={`/clients/${check.clientId}`} className="text-blue-600 hover:underline">{check.client.name}</Link>}
            {check.matter && <Link href={`/matters/${check.matterId}`} className="text-blue-600 hover:underline">{check.matter.name}</Link>}
            <span>Created: {new Date(check.createdAt).toLocaleDateString()}</span>
            {check.expiresAt && <span>Expires: {new Date(check.expiresAt).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>

      {/* Client Portal Link */}
      {check.status === "PENDING_CLIENT" && check.clientPortalUrl && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">Waiting for client to complete verification</p>
                <div className="flex gap-2 mt-2">
                  <code className="text-xs bg-white px-2 py-1 rounded font-mono">{check.clientPortalUrl}</code>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(check.clientPortalUrl!); toast({ title: "Copied" }); }}><Copy className="h-3 w-3" /></Button>
                </div>
              </div>
              <Button size="sm" onClick={() => resendMut.mutate({ id })} disabled={resendMut.isLoading}><Send className="h-3 w-3 mr-1" /> Resend</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><ShieldCheck className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="screening"><ShieldAlert className="h-4 w-4 mr-1" /> Screening</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-1" /> Documents</TabsTrigger>
          <TabsTrigger value="monitoring"><Eye className="h-4 w-4 mr-1" /> Monitoring</TabsTrigger>
          <TabsTrigger value="activity"><Clock className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Subject Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{check.subjectName}</span></div>
                <div><span className="text-gray-500">Type:</span> {check.subjectType}</div>
                {check.subjectEmail && <div><span className="text-gray-500">Email:</span> {check.subjectEmail}</div>}
                {check.subjectPhone && <div><span className="text-gray-500">Phone:</span> {check.subjectPhone}</div>}
                {check.subjectNationality && <div><span className="text-gray-500">Nationality:</span> {check.subjectNationality}</div>}
                {check.subjectDOB && <div><span className="text-gray-500">DOB:</span> {new Date(check.subjectDOB).toLocaleDateString()}</div>}
                {check.companyName && <div><span className="text-gray-500">Company:</span> {check.companyName}</div>}
                {check.companyRegistrationNumber && <div><span className="text-gray-500">Reg #:</span> {check.companyRegistrationNumber}</div>}
              </div>
            </CardContent>
          </Card>

          {/* Risk Score */}
          {check.riskScore != null && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Risk Assessment</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 mb-4">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${RISK_COLORS[check.overallRiskLevel || "MEDIUM"]}`}>
                    <span className="text-2xl font-bold">{check.riskScore}</span>
                  </div>
                  <div><p className="text-lg font-medium">{check.overallRiskLevel} Risk</p><p className="text-sm text-gray-500">Score: {check.riskScore}/100</p></div>
                </div>
                {check.aiRiskAssessment && <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg"><p className="whitespace-pre-wrap">{check.aiRiskAssessment}</p></div>}
                <Button variant="outline" size="sm" className="mt-3" onClick={() => narrativeMut.mutate({ id })} disabled={narrativeMut.isLoading}><RefreshCw className={`h-3 w-3 mr-1 ${narrativeMut.isLoading ? "animate-spin" : ""}`} /> Generate Narrative</Button>
              </CardContent>
            </Card>
          )}

          {/* Decision */}
          {check.status !== "PASSED" && check.status !== "FAILED" && check.status !== "CANCELLED" && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Decision</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder="Decision notes..." value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMut.mutate({ id, approvedBy: "Current User", notes: decisionNotes })} disabled={approveMut.isLoading}><CheckCircle className="h-4 w-4 mr-1" /> Approve</Button>
                  <Button variant="destructive" onClick={() => rejectMut.mutate({ id, rejectedBy: "Current User", decisionReason: decisionNotes || "Failed compliance check" })} disabled={rejectMut.isLoading}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                  <Button variant="outline" className="text-amber-600" onClick={() => referMut.mutate({ id, referredBy: "Current User", reason: decisionNotes || "Requires enhanced due diligence" })} disabled={referMut.isLoading}><AlertTriangle className="h-4 w-4 mr-1" /> Refer for EDD</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {check.approvedBy && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6"><p className="text-sm text-emerald-700"><CheckCircle className="h-4 w-4 inline mr-1" /> Approved by {check.approvedBy} on {check.approvedAt ? new Date(check.approvedAt).toLocaleString() : ""}</p>{check.decisionReason && <p className="text-xs text-emerald-600 mt-1">{check.decisionReason}</p>}</CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Screening */}
        <TabsContent value="screening" className="space-y-4">
          {/* Sanctions */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Sanctions Screening</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-sm font-medium ${MATCH_COLORS[check.sanctionsResult || ""] || "text-gray-500"}`}>{check.sanctionsResult ? check.sanctionsResult.replace("_", " ") : "Not yet checked"}</p>
              {sanctionsMatches.length > 0 && (
                <div className="mt-3 space-y-2">{sanctionsMatches.map((m: any, i: number) => (
                  <div key={i} className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
                    <p className="text-sm font-medium">{m.matchedName || m.name}</p>
                    <p className="text-xs text-gray-600">{m.listName} · Score: {m.matchScore}%</p>
                    {m.details && <p className="text-xs text-gray-500 mt-1">{m.details}</p>}
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          {/* PEP */}
          <Card>
            <CardHeader><CardTitle className="text-sm">PEP Screening</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-sm font-medium ${MATCH_COLORS[check.pepResult || ""] || "text-gray-500"}`}>{check.pepResult ? check.pepResult.replace("_", " ") : "Not yet checked"}</p>
              {pepMatches.length > 0 && (
                <div className="mt-3 space-y-2">{pepMatches.map((m: any, i: number) => (
                  <div key={i} className="p-3 border border-amber-200 bg-amber-50 rounded-lg">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-gray-600">{m.position} · {m.country} · Level: {m.level}</p>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          {/* Adverse Media */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Adverse Media</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-sm font-medium ${MATCH_COLORS[check.adverseMediaResult || ""] || "text-gray-500"}`}>{check.adverseMediaResult ? check.adverseMediaResult.replace("_", " ") : "Not yet checked"}</p>
              {adverseMediaMatches.length > 0 && (
                <div className="mt-3 space-y-2">{adverseMediaMatches.map((m: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <p className="text-sm font-medium">{m.headline || m.source}</p>
                    <p className="text-xs text-gray-500">{m.date} · {m.source}</p>
                    {m.summary && <p className="text-xs text-gray-600 mt-1">{m.summary}</p>}
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader><CardTitle className="text-sm">Compliance Documents ({check.documents?.length || 0})</CardTitle></CardHeader>
            <CardContent>
              {check.documents && check.documents.length > 0 ? (
                <div className="space-y-2">
                  {check.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{doc.documentType.replace(/_/g, " ")}</p>
                          <p className="text-xs text-gray-500">{doc.fileName}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_STATUS[doc.status]}`}>{doc.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No documents submitted yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring */}
        <TabsContent value="monitoring">
          <Card>
            <CardHeader><CardTitle className="text-sm">Ongoing Monitoring</CardTitle></CardHeader>
            <CardContent>
              {check.ongoingMonitoringId ? (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-700">Monitoring Active</p>
                  {check.lastMonitoringCheck && <p className="text-xs text-blue-600">Last: {new Date(check.lastMonitoringCheck).toLocaleDateString()}</p>}
                  {check.nextMonitoringCheck && <p className="text-xs text-blue-600">Next: {new Date(check.nextMonitoringCheck).toLocaleDateString()}</p>}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No active monitoring. Start monitoring to receive alerts on changes.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-sm">Activity Log</CardTitle></CardHeader>
            <CardContent>
              {check.activities && check.activities.length > 0 ? (
                <div className="space-y-3">
                  {check.activities.map((act: any) => (
                    <div key={act.id} className="flex gap-3 text-sm">
                      <div className="w-24 text-xs text-gray-400 flex-shrink-0">{new Date(act.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="flex-1">
                        <p className="text-gray-700">{act.description}</p>
                        <p className="text-xs text-gray-400">{act.performedBy || "system"} · {act.activityType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No activity recorded.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
