"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, FileText, Users, Sparkles, MessageSquare, Play, CheckCircle, AlertTriangle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { SETUP: "bg-amber-100 text-amber-700", IN_PROGRESS: "bg-blue-100 text-blue-700", COMPLETED: "bg-emerald-100 text-emerald-700", ARCHIVED: "bg-gray-100 text-gray-500" };
const ADMISSION_COLORS: Record<string, string> = { NOT_OFFERED: "bg-gray-100 text-gray-600", OFFERED: "bg-blue-100 text-blue-700", ADMITTED: "bg-emerald-100 text-emerald-700", OBJECTED: "bg-red-100 text-red-700", EXCLUDED: "bg-red-200 text-red-800", RESERVED: "bg-amber-100 text-amber-700" };

export default function DepositionDetailPage() {
  const { id } = useParams() as { id: string };
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: session, isLoading } = trpc.visuals["deposition.get"].useQuery({ id });
  const analyzeMut = trpc.visuals["deposition.analyze"].useMutation({ onSuccess: () => { utils.visuals["deposition.get"].invalidate({ id }); toast({ title: "Analysis generated" }); } });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!session) return <p className="text-center py-12 text-gray-400">Session not found.</p>;

  const keyTestimony = session.aiKeyTestimony ? JSON.parse(session.aiKeyTestimony) : [];
  const impeachmentPoints = session.aiImpeachmentPoints ? JSON.parse(session.aiImpeachmentPoints) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{session.deponentName}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[session.status]}`}>{session.status}</span>
          </div>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>{session.matter?.name}</span>
            <span>{new Date(session.depositionDate).toLocaleDateString()}</span>
            <span>{session.location || session.locationType}</span>
            <span>{session.exhibitCount} exhibits</span>
          </div>
        </div>
        {session.status === "COMPLETED" && !session.aiDepoSummary && (
          <Button onClick={() => analyzeMut.mutate({ sessionId: id })} disabled={analyzeMut.isLoading}>
            {analyzeMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />} Analyze
          </Button>
        )}
      </div>

      <Tabs defaultValue="exhibits">
        <TabsList>
          <TabsTrigger value="exhibits"><FileText className="h-4 w-4 mr-1" /> Exhibits</TabsTrigger>
          <TabsTrigger value="annotations"><MessageSquare className="h-4 w-4 mr-1" /> Annotations</TabsTrigger>
          <TabsTrigger value="analysis"><Sparkles className="h-4 w-4 mr-1" /> Analysis</TabsTrigger>
          <TabsTrigger value="info"><Users className="h-4 w-4 mr-1" /> Info</TabsTrigger>
        </TabsList>

        <TabsContent value="exhibits">
          <Card>
            <CardContent className="pt-6">
              {session.exhibits && session.exhibits.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="pb-2 text-left font-medium text-gray-500">#</th><th className="pb-2 text-left font-medium text-gray-500">Title</th><th className="pb-2 text-left font-medium text-gray-500">Pages</th><th className="pb-2 text-center font-medium text-gray-500">Status</th><th className="pb-2 text-center font-medium text-gray-500">Confidential</th></tr></thead>
                  <tbody>
                    {session.exhibits.map((ex: any) => (
                      <tr key={ex.id} className="border-b last:border-0">
                        <td className="py-2 font-mono">{ex.exhibitNumber}</td>
                        <td className="py-2 font-medium">{ex.title}</td>
                        <td className="py-2">{ex.pageCount || "—"}</td>
                        <td className="py-2 text-center">{ex.admissionStatus ? <span className={`text-xs px-2 py-0.5 rounded-full ${ADMISSION_COLORS[ex.admissionStatus]}`}>{ex.admissionStatus.replace(/_/g, " ")}</span> : "—"}</td>
                        <td className="py-2 text-center">{ex.isConfidential ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{ex.confidentialityDesignation || "CONF"}</span> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-center text-gray-400 py-8">No exhibits added.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annotations">
          <Card>
            <CardContent className="pt-6">
              {session.annotations && session.annotations.length > 0 ? (
                <div className="space-y-2">
                  {session.annotations.map((a: any) => (
                    <div key={a.id} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{a.annotationType}</span><span className="text-xs text-gray-400">{a.createdBy}</span>{a.isPrivate && <span className="text-xs text-amber-600">Private</span>}</div>
                      {a.content && <p className="text-sm">{a.content}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-center text-gray-400 py-8">No annotations.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {session.aiDepoSummary ? (
            <>
              <Card><CardHeader><CardTitle className="text-sm">Deposition Summary</CardTitle></CardHeader><CardContent><div className="prose prose-sm max-w-none"><p className="whitespace-pre-wrap">{session.aiDepoSummary}</p></div></CardContent></Card>
              {keyTestimony.length > 0 && (
                <Card><CardHeader><CardTitle className="text-sm">Key Testimony ({keyTestimony.length})</CardTitle></CardHeader><CardContent className="space-y-2">
                  {keyTestimony.map((t: any, i: number) => (
                    <div key={i} className="p-3 border rounded-lg"><p className="text-sm font-medium">{t.testimony || t.statement}</p><p className="text-xs text-gray-500">{t.topic} · {t.significance}</p></div>
                  ))}
                </CardContent></Card>
              )}
              {impeachmentPoints.length > 0 && (
                <Card className="border-red-200"><CardHeader><CardTitle className="text-sm text-red-700">Impeachment Points ({impeachmentPoints.length})</CardTitle></CardHeader><CardContent className="space-y-2">
                  {impeachmentPoints.map((p: any, i: number) => (
                    <div key={i} className="p-3 border border-red-200 bg-red-50 rounded-lg"><p className="text-sm font-medium">{p.statement}</p><p className="text-xs text-red-600">Contradicts: {p.contradicts}</p>{p.source && <p className="text-xs text-gray-500">Source: {p.source}</p>}</div>
                  ))}
                </CardContent></Card>
              )}
            </>
          ) : <Card><CardContent className="py-12 text-center text-gray-400"><Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>{session.status === "COMPLETED" ? "Analysis not yet generated. Click 'Analyze' above." : "Analysis available after deposition completes."}</p></CardContent></Card>}
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Examining Attorney:</span> <span className="font-medium">{session.examiningAttorney || "—"}</span></div>
              <div><span className="text-gray-500">Defending Attorney:</span> <span className="font-medium">{session.defendingAttorney || "—"}</span></div>
              <div><span className="text-gray-500">Court Reporter:</span> <span className="font-medium">{session.courtReporter || "—"}</span></div>
              <div><span className="text-gray-500">Videographer:</span> <span className="font-medium">{session.videographer || "—"}</span></div>
              <div><span className="text-gray-500">Location Type:</span> <span className="font-medium">{session.locationType}</span></div>
              <div><span className="text-gray-500">Deponent Role:</span> <span className="font-medium">{session.deponentRole || "—"}</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
