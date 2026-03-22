"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = trpc.courtCompanion["getSessionDetail"].useQuery({ sessionId: id });
  const convertNotes = trpc.courtCompanion["convertSessionNotes"].useMutation();
  const convertSteps = trpc.courtCompanion["convertNextSteps"].useMutation();

  const s = session.data;

  if (session.isLoading) {
    return <div className="p-6 text-muted-foreground">Loading session...</div>;
  }

  if (!s) {
    return <div className="p-6 text-muted-foreground">Session not found.</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{s.matterName}</h1>
        <p className="text-muted-foreground">
          {new Date(s.date).toLocaleDateString()} &middot; {s.duration}
        </p>
      </div>

      {/* Quick Notes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Quick Notes</h2>
          <button
            onClick={() => convertNotes.mutateAsync({ sessionId: id })}
            disabled={convertNotes.isPending}
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {convertNotes.isPending ? "Converting..." : "Convert Notes"}
          </button>
        </div>
        {s.notes?.length ? (
          <div className="space-y-2">
            {s.notes.map((n: any, i: number) => (
              <div key={i} className="border rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded">{n.category}</span>
                </div>
                <p className="text-sm">{n.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No notes recorded.</p>
        )}
      </section>

      {/* Checklist */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Checklist</h2>
        {s.checklist?.length ? (
          <div className="space-y-2">
            {s.checklist.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 border rounded-lg px-4 py-2">
                <span className={`text-lg ${item.done ? "text-green-600" : "text-muted-foreground"}`}>
                  {item.done ? "\u2713" : "\u25CB"}
                </span>
                <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No checklist items.</p>
        )}
      </section>

      {/* Outcome */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Outcome</h2>
        <div className="border rounded-lg p-4">
          <p className="text-sm whitespace-pre-wrap">{s.outcome || "No outcome recorded."}</p>
        </div>
      </section>

      {/* Next Steps */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Next Steps</h2>
          <button
            onClick={() => convertSteps.mutateAsync({ sessionId: id })}
            disabled={convertSteps.isPending}
            className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {convertSteps.isPending ? "Creating..." : "Create Tasks"}
          </button>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm whitespace-pre-wrap">{s.nextSteps || "No next steps recorded."}</p>
        </div>
      </section>
    </div>
  );
}
