"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Upload, Copy, Download, FileText, Loader2, CheckCircle2 } from "lucide-react";

export default function TranscriptionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("auto");
  const [matterId, setMatterId] = useState("");
  const [transcript, setTranscript] = useState<any>(null);
  const [transcribing, setTranscribing] = useState(false);

  const transcribeMut = trpc.ai["transcription.transcribeFile"].useMutation();

  const handleTranscribe = async () => {
    if (!file) return;
    setTranscribing(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const result = await transcribeMut.mutateAsync({ fileContent: base64, mimeType: file.type, language: language === "auto" ? undefined : language, matterId: matterId || undefined });
      setTranscript(result);
    } finally { setTranscribing(false); }
  };

  const copyTranscript = () => { if (transcript?.text) navigator.clipboard.writeText(transcript.text); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Transcription Center</h1>
        <p className="text-gray-500 mt-1 text-sm">Transcribe audio and video using OpenAI Whisper — best-in-class accuracy for legal terminology</p>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors">
          <input type="file" accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a,.webm,.ogg" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="audio-upload" />
          <label htmlFor="audio-upload" className="cursor-pointer">
            <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">{file ? file.name : "Drop audio/video files here or click to upload"}</p>
            <p className="text-xs text-gray-400 mt-1">Supported: MP3, MP4, WAV, M4A, WebM, OGG</p>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="zh">Chinese</SelectItem>
              <SelectItem value="ja">Japanese</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleTranscribe} disabled={!file || transcribing} className="bg-blue-500 hover:bg-blue-600">
            {transcribing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Transcribing...</> : <><Mic className="h-4 w-4 mr-1" /> Transcribe</>}
          </Button>
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <h2 className="text-base font-semibold text-gray-900">Transcript</h2>
              {transcript.duration && <Badge variant="outline">{Math.round(transcript.duration)}s</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyTranscript}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
              <Button variant="outline" size="sm" onClick={() => { const blob = new Blob([transcript.text], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "transcript.txt"; a.click(); }}>
                <Download className="h-4 w-4 mr-1" /> TXT
              </Button>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{transcript.text}</p>
          </div>
          {transcript.segments && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Segments</h3>
              {transcript.segments.slice(0, 20).map((seg: any, i: number) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0">{Math.floor(seg.start / 60)}:{(Math.floor(seg.start) % 60).toString().padStart(2, "0")}</span>
                  <span className="text-gray-700">{seg.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
