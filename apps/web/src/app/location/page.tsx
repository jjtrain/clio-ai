"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { MapPin, Clock, Mic, Scale, LogOut, Building2, Plus } from "lucide-react";

function formatDuration(start: string | Date): string {
  const ms = Date.now() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function LocationPage() {
  const [selectedCourthouse, setSelectedCourthouse] = useState("");
  const active = trpc.location["getActive"].useQuery({ userId: "current-user" });
  const history = trpc.location["getHistory"].useQuery({ userId: "current-user" });
  const courthouses = trpc.location["courthouses.list"].useQuery({});
  const matters = trpc.location["getMattersForCourthouse"].useQuery(
    { courthouseId: active.data?.courthouseId || "" },
    { enabled: !!active.data?.courthouseId }
  );
  const checkIn = trpc.location["checkIn"].useMutation({ onSuccess: () => active.refetch() });
  const checkOut = trpc.location["checkOut"].useMutation({ onSuccess: () => { active.refetch(); history.refetch(); } });
  const seed = trpc.location["courthouses.seed"].useMutation({ onSuccess: () => courthouses.refetch() });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6" /> Court Check-In</h1>
        <p className="text-muted-foreground">Track courthouse visits and access your matters</p>
      </div>

      {/* Active Check-In */}
      <section className="border rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5" /> Active Check-In</h2>
        {active.isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : active.data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg">{(active.data as any).courthouse?.name}</p>
                <p className="text-sm text-muted-foreground">Checked in {formatDuration((active.data as any).checkInTime)}</p>
              </div>
              <button onClick={() => checkOut.mutate({ checkInId: (active.data as any).id })} className="flex items-center gap-1 bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600">
                <LogOut className="h-4 w-4" /> Check Out
              </button>
            </div>
            {matters.data && (matters.data as any[]).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Matters at this courthouse:</p>
                {(matters.data as any[]).map((m: any) => (
                  <div key={m.id} className="text-sm py-1 border-b last:border-0">{m.name} - {m.client?.name}</div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Link href="/court" className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-2 rounded text-sm"><Scale className="h-4 w-4" /> Court Mode</Link>
              <Link href="/voice-notes" className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-2 rounded text-sm"><Mic className="h-4 w-4" /> Voice Note</Link>
              <Link href="/time" className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-2 rounded text-sm"><Clock className="h-4 w-4" /> Log Time</Link>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No active check-in. Select a courthouse below to check in.</p>
        )}
      </section>

      {/* Manual Check-In */}
      {!active.data && (
        <section className="border rounded-lg p-5 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="h-5 w-5" /> Manual Check-In</h2>
          <div className="flex gap-2">
            <select value={selectedCourthouse} onChange={(e) => setSelectedCourthouse(e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm">
              <option value="">Select a courthouse...</option>
              {(courthouses.data as any[] || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} - {c.city}, {c.state}</option>
              ))}
            </select>
            <button disabled={!selectedCourthouse} onClick={() => checkIn.mutate({ courthouseId: selectedCourthouse, userId: "current-user" })} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Plus className="h-4 w-4 inline mr-1" /> Check In
            </button>
          </div>
        </section>
      )}

      {/* Today's Court Dates */}
      <section className="border rounded-lg p-5">
        <h2 className="text-lg font-semibold mb-2">Today's Court Dates</h2>
        <p className="text-sm text-muted-foreground">No court dates scheduled for today.</p>
      </section>

      {/* Recent Check-Ins */}
      <section className="border rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-semibold">Recent Check-Ins</h2>
        {history.isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (history.data as any[] || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-in history yet.</p>
        ) : (
          <div className="space-y-2">
            {(history.data as any[]).map((ci: any) => (
              <div key={ci.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{ci.courthouse?.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(ci.checkInTime).toLocaleDateString()} - {ci.checkOutTime ? formatDuration(ci.checkInTime) : "In progress"}</p>
                </div>
                <Link href={`/location/courthouses/${ci.courthouseId}`} className="text-xs text-primary hover:underline">View</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Seed Button */}
      <div className="flex justify-end">
        <button onClick={() => seed.mutate()} className="text-sm text-muted-foreground hover:text-primary border rounded px-3 py-1.5">
          {seed.isLoading ? "Seeding..." : "Seed Courthouses"}
        </button>
      </div>
    </div>
  );
}
