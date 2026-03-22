"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const categoryStyle: Record<string, { label: string; cls: string }> = {
  CASE_UPDATE: { label: "Case Update", cls: "bg-blue-100 text-blue-800" },
  COURT_APPEARANCE: { label: "Court", cls: "bg-purple-100 text-purple-800" },
  CLIENT_CALL: { label: "Client Call", cls: "bg-green-100 text-green-800" },
  DEPOSITION: { label: "Deposition", cls: "bg-teal-100 text-teal-800" },
  RESEARCH: { label: "Research", cls: "bg-cyan-100 text-cyan-800" },
  BILLING: { label: "Billing", cls: "bg-amber-100 text-amber-800" },
  STRATEGY: { label: "Strategy", cls: "bg-rose-100 text-rose-800" },
  WITNESS_INTERVIEW: { label: "Witness", cls: "bg-orange-100 text-orange-800" },
  GENERAL: { label: "General", cls: "bg-gray-100 text-gray-700" },
};

function fmtDur(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function VoiceNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const noteQuery = trpc.voiceNotes["get"].useQuery({ voiceNoteId: id });
  const updateMutation = trpc.voiceNotes["update"].useMutation({ onSuccess: () => { noteQuery.refetch(); setEditing(false); } });
  const convertTimeMutation = trpc.voiceNotes["convertToTimeEntry"].useMutation({ onSuccess: () => noteQuery.refetch() });
  const convertTasksMutation = trpc.voiceNotes["convertToTasks"].useMutation({ onSuccess: () => noteQuery.refetch() });
  const reprocessMutation = trpc.voiceNotes["reprocess"].useMutation({ onSuccess: () => noteQuery.refetch() });
  const deleteMutation = trpc.voiceNotes["delete"].useMutation({ onSuccess: () => window.history.back() });
  const utils = trpc.useUtils();

  const note = noteQuery.data;
  if (noteQuery.isLoading) return <div className="max-w-3xl mx-auto p-6 text-center text-gray-500">Loading...</div>;
  if (!note) return <div className="max-w-3xl mx-auto p-6 text-center text-gray-500">Voice note not found</div>;

  const cat = categoryStyle[note.category] || categoryStyle.GENERAL;
  const entities = note.autoDetectedEntities ? (() => { try { return JSON.parse(note.autoDetectedEntities as string); } catch { return null; } })() : null;
  const tasks = note.suggestedTasks ? (() => { try { return JSON.parse(note.suggestedTasks as string); } catch { return null; } })() : null;
  const docket = note.suggestedDocketEntry ? (() => { try { return JSON.parse(note.suggestedDocketEntry as string); } catch { return note.suggestedDocketEntry; } })() : null;

  const startEdit = () => { setEditText(note.transcription || ""); setEditing(true); };
  const saveEdit = () => updateMutation.mutate({ voiceNoteId: id, editedTranscription: editText });

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/voice-notes" className="text-sm text-blue-600 hover:underline mb-2 inline-block">&larr; All Voice Notes</Link>
        {note.matter && (
          <Link href={`/matters/${note.matterId}`} className="block text-sm text-blue-600 hover:underline mb-1">{(note.matter as any).name || note.matterId}</Link>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
          <span className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleString()}</span>
          {note.audioDuration != null && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-mono">{fmtDur(note.audioDuration)}</span>}
          <span className="text-xs text-gray-500">by {note.authorName}</span>
          {note.isPinned && <span className="text-xs text-yellow-600">📌 Pinned</span>}
          {note.isPrivileged && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">Privileged</span>}
        </div>
      </div>

      {/* Transcription */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Transcription</h2>
          {!editing ? (
            <button onClick={startEdit} className="text-xs text-blue-600 hover:underline">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveEdit} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Save</button>
              <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 bg-gray-200 rounded">Cancel</button>
            </div>
          )}
        </div>
        {editing ? (
          <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
            className="w-full h-40 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        ) : (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.transcription || "No transcription available"}</p>
        )}
      </div>

      {/* Summary */}
      {note.summary && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Summary</h2>
          <p className="text-sm text-gray-800">{note.summary}</p>
        </div>
      )}

      {/* Entities */}
      {entities && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Detected Entities</h2>
          <div className="flex gap-2 flex-wrap">
            {entities.dates?.map((d: string, i: number) => <span key={`d${i}`} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">📅 {d}</span>)}
            {entities.amounts?.map((a: string, i: number) => <span key={`a${i}`} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">💰 {a}</span>)}
            {entities.people?.map((p: string, i: number) => <span key={`p${i}`} className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full">👤 {p}</span>)}
          </div>
        </div>
      )}

      {/* Tags */}
      {note.tags && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Tags</h2>
          <div className="flex gap-1 flex-wrap">
            {(JSON.parse(note.tags) as string[]).map((t: string) => <span key={t} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">{t}</span>)}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {note.suggestedDuration != null && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">💡 Suggested Time Entry</h2>
          <p className="text-sm text-amber-900 mb-2">Duration: {fmtDur(note.suggestedDuration)} &middot; {note.suggestedActivity || "General"}</p>
          <button onClick={() => convertTimeMutation.mutate({ voiceNoteId: id })}
            disabled={convertTimeMutation.isPending}
            className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
            {convertTimeMutation.isPending ? "Creating..." : "Create Time Entry"}
          </button>
        </div>
      )}

      {docket && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-blue-800 mb-2">📅 Suggested Deadline</h2>
          <p className="text-sm text-blue-900 mb-2">{typeof docket === "string" ? docket : docket.description || JSON.stringify(docket)}</p>
          <button className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Deadline</button>
        </div>
      )}

      {tasks && Array.isArray(tasks) && tasks.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-green-800 mb-2">✓ Suggested Tasks</h2>
          <ul className="space-y-1 mb-3">
            {tasks.map((t: any, i: number) => (
              <li key={i} className="text-sm text-green-900 flex items-start gap-2">
                <span className="mt-0.5">•</span> {typeof t === "string" ? t : t.title || t.description}
              </li>
            ))}
          </ul>
          <button onClick={() => convertTasksMutation.mutate({ voiceNoteId: id })}
            disabled={convertTasksMutation.isPending}
            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {convertTasksMutation.isPending ? "Creating..." : "Create Tasks"}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button onClick={() => reprocessMutation.mutate({ voiceNoteId: id })}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Reprocess</button>
        <button onClick={() => updateMutation.mutate({ voiceNoteId: id, isPinned: !note.isPinned })}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">{note.isPinned ? "Unpin" : "Pin"}</button>
        <button onClick={() => { if (confirm("Delete this voice note?")) deleteMutation.mutate({ voiceNoteId: id }); }}
          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 ml-auto">Delete</button>
      </div>
    </div>
  );
}
