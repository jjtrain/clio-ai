"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function CourtLauncherPage() {
  const matters = trpc.courtCompanion["getRecentMatters"].useQuery();
  const sessions = trpc.courtCompanion["getRecentSessions"].useQuery();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Court Companion</h1>
        <p className="text-muted-foreground">Enter court mode for focused matter access</p>
      </div>

      {/* Recent Matters */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Matters</h2>
        {matters.isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matters.data?.map((m: any) => (
              <div key={m.id} className="border rounded-lg p-4 space-y-3">
                <div>
                  <h3 className="font-semibold truncate">{m.name}</h3>
                  <p className="text-sm text-muted-foreground">{m.clientName}</p>
                  {m.practiceArea && (
                    <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {m.practiceArea}
                    </span>
                  )}
                </div>
                <Link
                  href={`/court/${m.id}`}
                  className="block text-center bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90"
                >
                  Enter Court Mode
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Sessions */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Sessions</h2>
        {sessions.isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : sessions.data?.length ? (
          <div className="space-y-2">
            {sessions.data.map((s: any) => (
              <div key={s.id} className="border rounded-lg px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.matterName}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(s.date).toLocaleDateString()} &middot; {s.duration}
                  </div>
                  {s.outcome && (
                    <p className="text-sm text-muted-foreground truncate mt-1">{s.outcome}</p>
                  )}
                </div>
                <Link
                  href={`/court/sessions/${s.id}`}
                  className="text-sm text-primary hover:underline whitespace-nowrap"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No sessions yet.</p>
        )}
      </section>
    </div>
  );
}
