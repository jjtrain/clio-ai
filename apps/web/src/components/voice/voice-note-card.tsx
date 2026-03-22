"use client";

import Link from "next/link";
import { useState } from "react";

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

function timeAgo(date: string | Date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDur(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function VoiceNoteCard({ note, showMatter, compact }: { note: any; showMatter?: boolean; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cat = categoryStyle[note.category] || categoryStyle.GENERAL;

  return (
    <Link href={`/voice-notes/${note.id}`} className="block border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
        <span className="text-xs text-gray-500">{timeAgo(note.createdAt)}</span>
        {note.audioDuration != null && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono">{fmtDur(note.audioDuration)}</span>
        )}
        {note.isPinned && <span className="text-xs text-yellow-600">📌 Pinned</span>}
        {note.isPrivileged && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">Privileged</span>}
      </div>
      {showMatter && note.matter?.name && (
        <p className="text-xs text-blue-600 mb-1 truncate">{note.matter.name}</p>
      )}
      {note.summary && <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{note.summary}</p>}
      {note.transcription && (
        <p className={`text-sm text-gray-600 ${compact && !expanded ? "line-clamp-3" : ""} ${!compact ? "line-clamp-3" : ""}`}
          onClick={compact ? (e) => { e.preventDefault(); setExpanded(!expanded); } : undefined}>
          {note.transcription}
        </p>
      )}
      {note.tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {note.tags.map((t: string) => (
            <span key={t} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{t}</span>
          ))}
        </div>
      )}
      <div className="flex gap-3 mt-2 text-xs text-gray-500">
        {note.suggestedDuration != null && <span>💡 time entry</span>}
        {note.suggestedDocketEntry && <span>📅 deadline</span>}
        {note.suggestedTasks && <span>✓ tasks</span>}
      </div>
    </Link>
  );
}
