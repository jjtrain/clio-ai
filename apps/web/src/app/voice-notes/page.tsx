"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import VoiceNoteCard from "@/components/voice/voice-note-card";
import VoiceRecorder from "@/components/voice/voice-recorder";

const categories = [
  { value: "", label: "All Categories" },
  { value: "CASE_UPDATE", label: "Case Update" },
  { value: "COURT_APPEARANCE", label: "Court Appearance" },
  { value: "CLIENT_CALL", label: "Client Call" },
  { value: "DEPOSITION", label: "Deposition" },
  { value: "RESEARCH", label: "Research" },
  { value: "BILLING", label: "Billing" },
  { value: "STRATEGY", label: "Strategy" },
  { value: "WITNESS_INTERVIEW", label: "Witness Interview" },
  { value: "GENERAL", label: "General" },
];

function fmtMins(sec: number) {
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export default function VoiceNotesPage() {
  const [showRecorder, setShowRecorder] = useState(false);
  const [matterId, setMatterId] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page] = useState(1);

  const notesQuery = trpc.voiceNotes["list"].useQuery({ take: 20 });
  const statsQuery = trpc.voiceNotes["getStats"].useQuery();
  const createMutation = trpc.voiceNotes["create"].useMutation({
    onSuccess: () => { notesQuery.refetch(); statsQuery.refetch(); setShowRecorder(false); },
  });

  const stats = statsQuery.data;
  const notes = (notesQuery.data as any) ?? [];
  const filtered = notes.filter((n: any) => {
    if (catFilter && n.category !== catFilter) return false;
    if (search && !(n.transcription?.toLowerCase().includes(search.toLowerCase()) || n.summary?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Voice Notes</h1>
        <button onClick={() => setShowRecorder(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /></svg>
          Record New
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Notes", value: (stats as any).total ?? 0 },
            { label: "Categories", value: Object.keys((stats as any).byCategory ?? {}).length },
            { label: "Total Audio", value: fmtMins(Number((stats as any).totalDuration ?? 0)) },
            { label: "Matters", value: Object.keys((stats as any).byMatter ?? {}).length },
          ].map((s) => (
            <div key={s.label} className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {showRecorder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">New Voice Note</h2>
              <input value={matterId} onChange={(e) => setMatterId(e.target.value)}
                placeholder="Enter Matter ID" className="mt-2 w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <VoiceRecorder matterId={matterId} authorName="Current User"
              onComplete={(data) => createMutation.mutate({ matterId, ...data })}
              onCancel={() => setShowRecorder(false)} />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..."
          className="flex-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {notesQuery.isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading notes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No voice notes found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note: any) => (
            <VoiceNoteCard key={note.id} note={note} showMatter compact />
          ))}
        </div>
      )}
    </div>
  );
}
