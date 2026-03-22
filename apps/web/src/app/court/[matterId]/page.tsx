"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

type QNote = { id: string; text: string; category: string; timestamp: Date };
type CItem = { id: string; text: string; done: boolean };
const CATS = ["Ruling", "Argument", "Objection", "Sidebar", "Observation", "General"] as const;

function LiveClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => { const d = new Date(); setT([d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":")); };
    f(); const id = setInterval(f, 1000); return () => clearInterval(id);
  }, []);
  return <span className="text-slate-400 font-mono text-sm">{t}</span>;
}

export default function CourtCompanionPage() {
  const { matterId } = useParams<{ matterId: string }>();
  const router = useRouter();
  const notesRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quickNotes, setQuickNotes] = useState<QNote[]>([]);
  const [checklist, setChecklist] = useState<CItem[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteCat, setNoteCat] = useState<string>("General");
  const [checkText, setCheckText] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const brief = trpc.courtCompanion["getMatterBrief"].useQuery({ matterId });
  const startMut = trpc.courtCompanion["startSession"].useMutation();
  const addNoteMut = trpc.courtCompanion["addQuickNote"].useMutation();
  const addItemMut = trpc.courtCompanion["addChecklistItem"].useMutation();
  const toggleMut = trpc.courtCompanion["toggleChecklistItem"].useMutation();
  const endMut = trpc.courtCompanion["endSession"].useMutation();

  useEffect(() => {
    if (matterId && !sessionId) startMut.mutateAsync({ matterId, userId: "current-user", deviceType: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop" }).then(r => setSessionId((r as any).session?.id));
  }, [matterId]);

  const b = brief.data;
  const isToday = (d: string | Date) => new Date(d).toDateString() === new Date().toDateString();

  const saveNote = async () => {
    if (!noteText.trim() || !sessionId) return;
    const n: QNote = { id: crypto.randomUUID(), text: noteText, category: noteCat, timestamp: new Date() };
    setQuickNotes(p => [n, ...p]); setNoteText(""); setShowNote(false);
    await addNoteMut.mutateAsync({ sessionId, text: n.text, category: n.category });
  };
  const addCheck = async () => {
    if (!checkText.trim() || !sessionId) return;
    const item: CItem = { id: crypto.randomUUID(), text: checkText, done: false };
    setChecklist(p => [...p, item]); setCheckText("");
    await addItemMut.mutateAsync({ sessionId, item: item.text });
  };
  const toggle = async (id: string) => {
    setChecklist(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i));
    const idx = checklist.findIndex(i => i.id === id);
    await toggleMut.mutateAsync({ sessionId: sessionId!, itemIndex: idx });
  };
  const handleEnd = async () => {
    if (!sessionId) return;
    await endMut.mutateAsync({ sessionId, outcome, nextSteps });
    router.push(`/matters/${matterId}`);
  };

  if (brief.isLoading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-lg">Loading court brief...</div>
    </div>
  );

  const solColor = b?.activeSol?.daysRemaining <= 30 ? "text-red-400" : b?.activeSol?.daysRemaining <= 90 ? "text-yellow-400" : "text-green-400";
  const sevCls = (s: string) => s === "high" ? "bg-red-600 text-white" : s === "medium" ? "bg-yellow-600 text-white" : "bg-slate-700 text-slate-300";

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <Link href={`/matters/${matterId}`} className="text-slate-400 hover:text-white text-xl">&larr;</Link>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold truncate">{b?.matterName}</div>
          <div className="text-slate-400 text-xs">{b?.indexNumber}</div>
        </div>
        <LiveClock />
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* KEY PEOPLE */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Key People</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Client</div>
              <div className="text-white font-semibold text-sm">{b?.client?.name}</div>
              {b?.client?.phone && <a href={`tel:${b.client.phone}`} className="text-blue-400 text-xs">Call</a>}
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Opposing Counsel</div>
              <div className="text-white font-semibold text-sm">{b?.opposingCounsel?.name}</div>
              <div className="text-slate-400 text-xs">{b?.opposingCounsel?.firm}</div>
              {b?.opposingCounsel?.phone && <a href={`tel:${b.opposingCounsel.phone}`} className="text-blue-400 text-xs">Call</a>}
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Judge</div>
              <div className="text-white font-semibold text-sm">{b?.judge?.name}</div>
              <div className="text-slate-400 text-xs">{b?.judge?.part}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">Opposing Party</div>
              <div className="text-white font-semibold text-sm">{b?.opposingParty?.name}</div>
            </div>
          </div>
        </section>

        {/* KEY DATES */}
        {b?.keyDates?.length ? (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Key Dates</h2>
            <div className="space-y-2">
              {b.keyDates.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2">
                  <span className="text-white font-mono text-sm whitespace-nowrap">{new Date(d.date).toLocaleDateString()}</span>
                  <span className="text-slate-300 text-sm flex-1 truncate">{d.title}</span>
                  {isToday(d.date)
                    ? <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded animate-pulse">TODAY</span>
                    : <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">{d.type}</span>}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ACTIVE SOL */}
        {b?.activeSol && (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Active SOL</h2>
            <div className="bg-slate-800 rounded-lg p-4 flex items-center gap-4">
              <div className={`text-4xl font-bold ${solColor}`}>{b.activeSol.daysRemaining}</div>
              <div>
                <div className="text-white text-sm font-medium">days remaining</div>
                <div className="text-slate-400 text-xs">{b.activeSol.causeOfAction}</div>
                <div className="text-slate-500 text-xs">Expires {new Date(b.activeSol.expirationDate).toLocaleDateString()}</div>
              </div>
            </div>
          </section>
        )}

        {/* COURT RULES */}
        {b?.courtReminders?.length ? (
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Court Rules</h2>
            <div className="space-y-2">
              {b.courtReminders.map((r: any, i: number) => (
                <div key={i} className="bg-slate-800 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${sevCls(r.severity)}`}>{r.severity}</span>
                  <span className="text-slate-300 text-sm">{r.text}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* QUICK NOTES */}
        <section ref={notesRef}>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Notes</h2>
          {!showNote ? (
            <button onClick={() => setShowNote(true)} className="bg-blue-600 text-white w-full py-3 text-lg rounded-lg font-medium">Add Note</button>
          ) : (
            <div className="bg-slate-800 rounded-lg p-3 space-y-3">
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Type your note..."
                className="w-full bg-slate-700 text-white rounded-lg p-3 text-sm border border-slate-600 focus:outline-none focus:border-blue-500 resize-none" rows={3} autoFocus />
              <div className="flex flex-wrap gap-2">
                {CATS.map(c => (
                  <button key={c} onClick={() => setNoteCat(c)}
                    className={`text-xs px-3 py-1 rounded-full ${noteCat === c ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300"}`}>{c}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveNote} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex-1">Save</button>
                <button onClick={() => setShowNote(false)} className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}
          {quickNotes.length > 0 && (
            <div className="mt-3 space-y-2">
              {quickNotes.map(n => (
                <div key={n.id} className="bg-slate-800 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-500 text-xs">{n.timestamp.toLocaleTimeString()}</span>
                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">{n.category}</span>
                  </div>
                  <div className="text-white text-sm">{n.text}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CHECKLIST */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Checklist</h2>
          <div className="flex gap-2 mb-3">
            <input value={checkText} onChange={e => setCheckText(e.target.value)} onKeyDown={e => e.key === "Enter" && addCheck()}
              placeholder="Add item..." className="flex-1 bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-slate-700 focus:outline-none focus:border-blue-500" />
            <button onClick={addCheck} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Add</button>
          </div>
          {checklist.map(item => (
            <div key={item.id} onClick={() => toggle(item.id)} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2 mb-2 cursor-pointer">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${item.done ? "bg-green-600 border-green-600" : "border-slate-600"}`}>
                {item.done && <span className="text-white text-xs">&#10003;</span>}
              </div>
              <span className={`text-sm ${item.done ? "text-slate-500 line-through" : "text-white"}`}>{item.text}</span>
            </div>
          ))}
        </section>
      </div>

      {/* BOTTOM BAR */}
      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-3 flex gap-2">
        <button onClick={() => notesRef.current?.scrollIntoView({ behavior: "smooth" })} className="bg-blue-600 text-white flex-1 py-3 rounded-lg font-medium">Note</button>
        {b?.client?.phone && <a href={`tel:${b.client.phone}`} className="bg-green-600 text-white flex-1 py-3 rounded-lg font-medium text-center">Call</a>}
        <button onClick={() => setShowEnd(true)} className="bg-red-600 text-white flex-1 py-3 rounded-lg font-medium">End</button>
      </div>

      {/* END SESSION MODAL */}
      {showEnd && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center">
          <div className="bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4">
            <h2 className="text-white text-lg font-semibold">End Session</h2>
            <textarea value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="Outcome..."
              className="w-full bg-slate-800 text-white rounded-lg p-3 text-sm border border-slate-700 focus:outline-none resize-none" rows={3} />
            <textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)} placeholder="Next steps..."
              className="w-full bg-slate-800 text-white rounded-lg p-3 text-sm border border-slate-700 focus:outline-none resize-none" rows={3} />
            <div className="flex gap-2">
              <button onClick={handleEnd} className="bg-red-600 text-white flex-1 py-3 rounded-lg font-medium">Save &amp; Exit</button>
              <button onClick={() => setShowEnd(false)} className="bg-slate-700 text-slate-300 flex-1 py-3 rounded-lg font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
