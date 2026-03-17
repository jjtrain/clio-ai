"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2, Video, Mic, FileText, CheckCircle, Users, Clock, Copy,
  ExternalLink, Sparkles, ListChecks, RefreshCw, Send, Plus, Play,
  AlertTriangle, Download, MessageSquare, Search,
} from "lucide-react";

function fmtDuration(min: number) { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }

const STATUS_COLORS: Record<string, string> = { WAITING: "bg-blue-100 text-blue-700", STARTED: "bg-green-100 text-green-700", ENDED: "bg-gray-100 text-gray-700", CANCELLED: "bg-red-100 text-red-700" };
const PRIORITY_COLORS: Record<string, string> = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-blue-100 text-blue-700" };

export default function MeetingDetailPage() {
  const { id } = useParams() as { id: string };
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const { data: meeting, isLoading } = trpc.zoom["meetings.get"].useQuery({ id });
  const { data: actionItems } = trpc.zoom["ai.getActionItems"].useQuery({ id }, { enabled: !!meeting?.aiActionItems });
  const { data: decisions } = trpc.zoom["ai.getDecisions"].useQuery({ id }, { enabled: !!meeting?.aiKeyDecisions });
  const { data: followUps } = trpc.zoom["ai.getFollowUps"].useQuery({ id }, { enabled: !!meeting?.aiFollowUps });
  const { data: participants } = trpc.zoom["participants.list"].useQuery({ id });
  const { data: recordings } = trpc.zoom["recordings.list"].useQuery({ id });
  const { data: chatLog } = trpc.zoom["recordings.getChatLog"].useQuery({ id });
  const { data: transcript } = trpc.zoom["recordings.getTranscript"].useQuery({ id });

  const summarizeMut = trpc.zoom["ai.summarize"].useMutation({ onSuccess: () => { utils.zoom["meetings.get"].invalidate({ id }); toast({ title: "Summary generated" }); } });
  const createTasksMut = trpc.zoom["ai.createTasks"].useMutation({ onSuccess: (data) => toast({ title: `${data.length} tasks created` }) });
  const followUpMut = trpc.zoom["ai.sendFollowUp"].useMutation({ onSuccess: () => toast({ title: "Follow-up email prepared" }) });
  const logTimeMut = trpc.zoom["time.autoLog"].useMutation({ onSuccess: () => { utils.zoom["meetings.get"].invalidate({ id }); toast({ title: "Time logged" }); } });
  const processRecMut = trpc.zoom["recordings.process"].useMutation({ onSuccess: () => { utils.zoom["meetings.get"].invalidate({ id }); toast({ title: "Recordings processed" }); } });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!meeting) return <p className="text-center py-12 text-gray-400">Meeting not found.</p>;

  const filteredTranscript = transcriptSearch && meeting.transcriptText
    ? meeting.transcriptText.split("\n").filter((l: string) => l.toLowerCase().includes(transcriptSearch.toLowerCase())).join("\n")
    : meeting.transcriptText;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{meeting.topic}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[meeting.status]}`}>{meeting.status}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{new Date(meeting.startTime).toLocaleString()}</span>
            <span>{fmtDuration(meeting.actualDuration || meeting.scheduledDuration)}</span>
            {meeting.matter && <Link href={`/matters/${meeting.matter.id}`} className="text-blue-600 hover:underline">{meeting.matter.name}</Link>}
            {meeting.client && <span>{meeting.client.name}</span>}
            <span>{meeting.participantCount} participants</span>
          </div>
        </div>
        <div className="flex gap-2">
          {meeting.status === "WAITING" && (
            <Button size="sm" onClick={() => { navigator.clipboard?.writeText(meeting.joinUrl); toast({ title: "Link copied" }); }}><Copy className="h-4 w-4 mr-1" /> Copy Link</Button>
          )}
          {meeting.status === "WAITING" && (
            <Button size="sm" onClick={() => window.open(meeting.joinUrl, "_blank")}><ExternalLink className="h-4 w-4 mr-1" /> Join</Button>
          )}
        </div>
      </div>

      {/* Info badges */}
      <div className="flex items-center gap-2">
        {meeting.hasRecording && <span className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded flex items-center gap-1"><Mic className="h-3 w-3" /> Recording</span>}
        {meeting.hasTranscript && <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded flex items-center gap-1"><FileText className="h-3 w-3" /> Transcript</span>}
        {meeting.aiSummary && <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Summary</span>}
        {meeting.timeEntryId && <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded flex items-center gap-1"><Clock className="h-3 w-3" /> Time Logged</span>}
      </div>

      <Tabs defaultValue={meeting.status === "ENDED" && meeting.aiSummary ? "summary" : "summary"}>
        <TabsList>
          <TabsTrigger value="summary"><Sparkles className="h-4 w-4 mr-1" /> Summary</TabsTrigger>
          <TabsTrigger value="transcript"><FileText className="h-4 w-4 mr-1" /> Transcript</TabsTrigger>
          <TabsTrigger value="recording"><Mic className="h-4 w-4 mr-1" /> Recording</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="h-4 w-4 mr-1" /> Chat</TabsTrigger>
          <TabsTrigger value="participants"><Users className="h-4 w-4 mr-1" /> Participants</TabsTrigger>
          <TabsTrigger value="time"><Clock className="h-4 w-4 mr-1" /> Time</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          {meeting.aiSummary ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Meeting Summary</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => summarizeMut.mutate({ id })} disabled={summarizeMut.isLoading}>
                      <RefreshCw className={`h-3 w-3 mr-1 ${summarizeMut.isLoading ? "animate-spin" : ""}`} /> Regenerate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent><div className="prose prose-sm max-w-none"><p className="whitespace-pre-wrap">{meeting.aiSummary}</p></div></CardContent>
              </Card>

              {decisions && decisions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Key Decisions ({decisions.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {decisions.map((d: any, i: number) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <p className="text-sm font-medium">{d.decision}</p>
                        {d.context && <p className="text-xs text-gray-500 mt-1">{d.context}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {actionItems && actionItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Action Items ({actionItems.length})</CardTitle>
                      <Button size="sm" variant="outline" onClick={() => createTasksMut.mutate({ id })} disabled={createTasksMut.isLoading}>
                        <ListChecks className="h-3 w-3 mr-1" /> Create Tasks
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {actionItems.map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                        <CheckCircle className="h-4 w-4 text-gray-300 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm">{a.item || a.task}</p>
                          <div className="flex gap-2 mt-1">
                            {a.assignedTo && <span className="text-xs text-gray-500">Assigned: {a.assignedTo}</span>}
                            {a.deadline && <span className="text-xs text-gray-500">Due: {a.deadline}</span>}
                            {a.priority && <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[a.priority] || ""}`}>{a.priority}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {meeting.client && (
                <Button variant="outline" onClick={() => followUpMut.mutate({ id })} disabled={followUpMut.isLoading}>
                  <Send className="h-4 w-4 mr-2" /> Send Follow-up Email
                </Button>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 mb-3">{meeting.status === "ENDED" ? "No summary generated yet." : "Summary will be available after the meeting ends."}</p>
                {meeting.status === "ENDED" && (
                  <Button onClick={() => summarizeMut.mutate({ id })} disabled={summarizeMut.isLoading}>
                    {summarizeMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Generate Summary
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Transcript</CardTitle>
                {transcript?.text && <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(transcript.text || ""); toast({ title: "Copied" }); }}><Copy className="h-3 w-3 mr-1" /> Copy</Button>}
              </div>
              {transcript?.text && (
                <div className="relative mt-2"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input className="pl-9" placeholder="Search transcript..." value={transcriptSearch} onChange={(e) => setTranscriptSearch(e.target.value)} /></div>
              )}
            </CardHeader>
            <CardContent>
              {filteredTranscript ? (
                <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg max-h-[600px] overflow-y-auto">{filteredTranscript}</pre>
              ) : (
                <p className="text-center text-gray-400 py-8">No transcript available. Enable cloud recording with transcription for future meetings.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recording Tab */}
        <TabsContent value="recording">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Recordings</CardTitle>
                {meeting.hasRecording && !meeting.recordingDocIds && (
                  <Button variant="outline" size="sm" onClick={() => processRecMut.mutate({ id })} disabled={processRecMut.isLoading}>
                    <Download className="h-3 w-3 mr-1" /> Save to Matter
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recordings && recordings.length > 0 ? (
                <div className="space-y-3">
                  {recordings.map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {f.fileType === "mp4" ? <Play className="h-5 w-5 text-blue-500" /> : f.fileType === "m4a" ? <Mic className="h-5 w-5 text-purple-500" /> : <FileText className="h-5 w-5 text-gray-500" />}
                        <div>
                          <p className="text-sm font-medium">{f.fileType?.toUpperCase()}</p>
                          <p className="text-xs text-gray-500">{f.fileSize ? `${(f.fileSize / 1048576).toFixed(1)} MB` : ""}</p>
                        </div>
                      </div>
                      {f.playUrl && <Button size="sm" variant="outline" onClick={() => window.open(f.playUrl, "_blank")}><Play className="h-3 w-3 mr-1" /> Play</Button>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No recordings available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card>
            <CardHeader><CardTitle className="text-sm">In-Meeting Chat</CardTitle></CardHeader>
            <CardContent>
              {chatLog && chatLog.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {chatLog.map((msg: any, i: number) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="text-xs text-gray-400 w-16 flex-shrink-0">{msg.timestamp}</span>
                      <span className="font-medium text-gray-700">{msg.from}:</span>
                      <span className="text-gray-600">{msg.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No chat messages.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants">
          <Card>
            <CardHeader><CardTitle className="text-sm">Participants ({participants?.length || 0})</CardTitle></CardHeader>
            <CardContent>
              {participants && participants.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="pb-2 text-left font-medium text-gray-500">Name</th><th className="pb-2 text-left font-medium text-gray-500">Email</th><th className="pb-2 text-left font-medium text-gray-500">Joined</th><th className="pb-2 text-left font-medium text-gray-500">Left</th><th className="pb-2 text-right font-medium text-gray-500">Duration</th></tr></thead>
                  <tbody>
                    {participants.map((p: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 font-medium">{p.name}</td>
                        <td className="py-2 text-gray-600">{p.email || "-"}</td>
                        <td className="py-2 text-gray-500">{p.joinTime ? new Date(p.joinTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                        <td className="py-2 text-gray-500">{p.leaveTime ? new Date(p.leaveTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                        <td className="py-2 text-right">{p.duration ? fmtDuration(Math.round(p.duration / 60)) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-400 py-8">No participant data available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time">
          <Card>
            <CardHeader><CardTitle className="text-sm">Time & Billing</CardTitle></CardHeader>
            <CardContent>
              {meeting.timeEntryId ? (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-5 w-5 text-green-500" /><span className="font-medium text-green-700">Time Logged</span></div>
                  <p className="text-sm text-gray-600">Duration: {fmtDuration(meeting.billableTime || meeting.actualDuration || meeting.scheduledDuration)}</p>
                  <p className="text-sm text-gray-600">Matter: {meeting.matter?.name || "Not linked"}</p>
                </div>
              ) : meeting.status === "ENDED" && meeting.matterId ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 mb-3">Meeting time not yet logged.</p>
                  <p className="text-sm text-gray-400 mb-4">Duration: {fmtDuration(meeting.actualDuration || meeting.scheduledDuration)} · Matter: {meeting.matter?.name}</p>
                  <Button onClick={() => logTimeMut.mutate({ id })} disabled={logTimeMut.isLoading}>
                    {logTimeMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                    Log Time
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-400">{meeting.status !== "ENDED" ? "Time can be logged after the meeting ends." : "Link this meeting to a matter to log time."}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
