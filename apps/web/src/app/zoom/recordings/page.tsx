"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Mic, FileText, Play, Search, Video, CheckCircle, Download } from "lucide-react";

export default function RecordingsPage() {
  const [search, setSearch] = useState("");

  const { data: recordings, isLoading } = trpc.zoom["recordings.listAll"].useQuery();
  const { data: searchResults } = trpc.zoom["ai.searchTranscripts"].useQuery({ query: search }, { enabled: search.length > 2 });
  const { data: storage } = trpc.zoom["reports.recordingStorage"].useQuery();

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Recording Library</h1><p className="text-sm text-slate-500">Browse and search meeting recordings and transcripts</p></div>

      {storage && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{storage.totalMeetings}</p><p className="text-xs text-gray-500">Meetings with Recordings</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{storage.totalFiles}</p><p className="text-xs text-gray-500">Total Files</p></CardContent></Card>
          <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{storage.totalSizeMB} MB</p><p className="text-xs text-gray-500">Storage Used</p></CardContent></Card>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input className="pl-9" placeholder="Search across all transcripts..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {search.length > 2 && searchResults && searchResults.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Transcript Search Results ({searchResults.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {searchResults.map((r: any, i: number) => (
              <Link key={i} href={`/zoom/meetings/${r.meetingId}`}>
                <div className="p-3 border rounded-lg hover:border-blue-300 transition-colors">
                  <p className="text-sm font-medium">{r.topic}</p>
                  <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString()}</p>
                  <p className="text-xs text-gray-600 mt-1 bg-yellow-50 p-2 rounded">{r.excerpt}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">All Recordings</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" /> : (
            <div className="space-y-3">
              {(recordings || []).map((m: any) => {
                const files = m.recordingFiles ? JSON.parse(m.recordingFiles) : [];
                return (
                  <Link key={m.id} href={`/zoom/meetings/${m.id}`}>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:border-blue-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <Video className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">{m.topic}</p>
                          <div className="flex gap-2 text-xs text-gray-500">
                            <span>{new Date(m.startTime).toLocaleDateString()}</span>
                            {m.matter && <span>· {m.matter.name}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {files.some((f: any) => f.fileType === "mp4") && <Play className="h-4 w-4 text-blue-400" />}
                        {files.some((f: any) => f.fileType === "m4a") && <Mic className="h-4 w-4 text-purple-400" />}
                        {m.hasTranscript && <FileText className="h-4 w-4 text-green-400" />}
                        {m.aiSummary && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                        {m.recordingDocIds && <Download className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>
                  </Link>
                );
              })}
              {(!recordings || recordings.length === 0) && <p className="text-center text-gray-400 py-8">No recordings yet.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
