"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Settings, MapPin, Clock, AlertTriangle, Car, Train, Footprints, ArrowLeft } from "lucide-react";

type View = "day" | "week" | "month";
const EVENT_COLORS: Record<string, string> = { court_hearing: "#EF4444", deposition: "#F97316", meeting: "#3B82F6", appointment: "#8B5CF6", personal: "#10B981" };
const STATUS_COLORS: Record<string, string> = { ok: "#22C55E", tight: "#EAB308", conflict: "#EF4444" };

function formatTime(d: Date | string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function formatDuration(min: number) { return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`; }

export default function MobileTravelCalendarPage() {
  const [view, setView] = useState<View>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPrefs, setShowPrefs] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const dateStr = currentDate.toISOString().split("T")[0];
  const dayView = trpc.travelCalendar["getDayView"].useQuery({ date: dateStr });

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const events = (dayView.data?.events ?? []) as any[];
  const travelSegments = (dayView.data?.travelSegments ?? []) as any[];
  const conflictCount = dayView.data?.conflictCount ?? 0;

  // Build interleaved timeline: events + travel cards
  const timeline = useMemo(() => {
    const items: Array<{ type: "event" | "travel"; data: any }> = [];
    const sorted = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    for (let i = 0; i < sorted.length; i++) {
      items.push({ type: "event", data: sorted[i] });
      const travel = travelSegments.find((t: any) => t.fromEvent?.id === sorted[i].id);
      if (travel) items.push({ type: "travel", data: travel });
    }
    return items;
  }, [events, travelSegments]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/calendar" className="text-slate-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="text-center">
            <p className="text-sm font-semibold">{currentDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
          </div>
          <button onClick={() => setShowPrefs(!showPrefs)} className="text-slate-400 hover:text-white"><Settings className="h-5 w-5" /></button>
        </div>
        {/* View switcher */}
        <div className="flex gap-1 mt-2 bg-slate-800 rounded-lg p-1">
          {(["day", "week", "month"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {/* Nav */}
        <div className="flex items-center justify-between mt-2">
          <button onClick={() => navigate(-1)} className="p-1 text-slate-400"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={goToday} className="text-xs text-blue-400 font-medium">Today</button>
          <button onClick={() => navigate(1)} className="p-1 text-slate-400"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Conflict Banner */}
      {conflictCount > 0 && (
        <div className="mx-4 mt-3 bg-red-900/50 border border-red-700 rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">⚠️ {conflictCount} scheduling conflict{conflictCount > 1 ? "s" : ""} today</p>
        </div>
      )}

      {/* Day View Timeline */}
      {view === "day" && (
        <div className="px-4 py-4 space-y-3">
          {dayView.isLoading && <p className="text-center text-slate-500 py-12">Loading schedule...</p>}
          {!dayView.isLoading && timeline.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Clock className="h-10 w-10 mx-auto mb-3 text-slate-600" />
              <p>No events today</p>
            </div>
          )}
          {timeline.map((item, idx) => {
            if (item.type === "event") {
              const e = item.data;
              const color = EVENT_COLORS[e.eventType] || "#6B7280";
              return (
                <div key={e.id || idx} onClick={() => setSelectedEvent(e === selectedEvent ? null : e)}
                  className="bg-slate-800 rounded-xl border-l-4 p-4 cursor-pointer hover:bg-slate-750 transition-colors"
                  style={{ borderLeftColor: color }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-mono">{formatTime(e.startTime)} – {formatTime(e.endTime)}</p>
                      <p className="font-semibold text-white mt-1 truncate">{e.title}</p>
                      {e.location && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2" style={{ backgroundColor: color + "20", color }}>{e.eventType?.replace("_", " ")}</span>
                  </div>
                  {/* Expanded detail */}
                  {selectedEvent?.id === e.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-sm">
                      {e.description && <p className="text-slate-300">{e.description}</p>}
                      {e.location && (
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(e.location)}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-400 text-xs hover:underline">
                          <MapPin className="h-3 w-3" /> Open in Maps
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Travel Card
            const t = item.data;
            const statusColor = STATUS_COLORS[t.status] || STATUS_COLORS.ok;
            const miles = t.distanceMeters ? Math.round(t.distanceMeters / 1609.34 * 10) / 10 : 0;
            const ModeIcon = t.travelMode === "transit" ? Train : t.travelMode === "walking" ? Footprints : Car;

            return (
              <div key={`travel-${idx}`} className="mx-2 border border-dashed rounded-lg p-3 transition-colors" style={{ borderColor: statusColor + "60", backgroundColor: statusColor + "08" }}>
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-full" style={{ backgroundColor: statusColor + "20" }}>
                    <ModeIcon className="h-4 w-4" style={{ color: statusColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: statusColor }}>
                      {t.travelMinutes} min {t.travelMode}{miles > 0 ? ` · ${miles} mi` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      Depart by <span className="font-medium text-slate-300">{formatTime(t.departBy)}</span>
                      {t.status === "tight" && " — cutting it close!"}
                      {t.status === "conflict" && " — ⚠️ not enough time!"}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                </div>
                {t.gapMinutes > 0 && (
                  <p className="text-[10px] text-slate-600 mt-1.5 pl-10">
                    Gap: {t.gapMinutes} min · Need: {t.travelMinutes + t.bufferMinutes} min (incl. {t.bufferMinutes} min buffer)
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Week View */}
      {view === "week" && (
        <div className="px-4 py-4">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(currentDate);
              d.setDate(d.getDate() - d.getDay() + i);
              const isToday = d.toDateString() === new Date().toDateString();
              const isSelected = d.toDateString() === currentDate.toDateString();
              return (
                <button key={i} onClick={() => { setCurrentDate(d); setView("day"); }}
                  className={`py-2 rounded-lg text-center transition-colors ${isSelected ? "bg-blue-600" : isToday ? "bg-slate-700" : "bg-slate-800 hover:bg-slate-700"}`}>
                  <p className="text-[10px] text-slate-400">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-blue-400" : "text-white"}`}>{d.getDate()}</p>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-400 text-center">Tap a day to see the timeline with travel times</p>
        </div>
      )}

      {/* Month View */}
      {view === "month" && (
        <div className="px-4 py-4">
          <p className="text-lg font-semibold text-center mb-3">{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
              const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
              const cells = [];
              for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`empty-${i}`} />);
              for (let d = 1; d <= last.getDate(); d++) {
                const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
                const isToday = date.toDateString() === new Date().toDateString();
                cells.push(
                  <button key={d} onClick={() => { setCurrentDate(date); setView("day"); }}
                    className={`py-2 rounded-lg text-sm transition-colors ${isToday ? "bg-blue-600 text-white font-bold" : "text-slate-300 hover:bg-slate-700"}`}>
                    {d}
                  </button>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPrefs && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end">
          <div className="w-full bg-slate-800 rounded-t-2xl p-6 max-h-[70vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Travel Preferences</h2>
              <button onClick={() => setShowPrefs(false)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Travel Mode</label>
                <div className="flex gap-2 mt-1">
                  {[{ mode: "driving", icon: Car, label: "Drive" }, { mode: "transit", icon: Train, label: "Transit" }, { mode: "walking", icon: Footprints, label: "Walk" }].map(m => (
                    <button key={m.mode} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-700 text-sm text-slate-300 hover:bg-slate-600">
                      <m.icon className="h-4 w-4" /> {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400">Buffer Time</label>
                <p className="text-white text-sm mt-1">15 minutes (default)</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">Alert Threshold</label>
                <p className="text-white text-sm mt-1">Warn when gap &lt; 30 minutes</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
