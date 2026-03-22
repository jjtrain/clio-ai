"use client";

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Plus, Settings, RefreshCw, ArrowLeft, Filter } from "lucide-react";
import Link from "next/link";
import DayTimelineView from "./DayTimelineView";
import WeekStripView from "./WeekStripView";
import MonthGridView from "./MonthGridView";
import EventDetailSheet from "./EventDetailSheet";
import TravelPreferencesModal from "./TravelPreferencesModal";
import AddEditEventModal from "./AddEditEventModal";

type View = "day" | "week" | "month";
type EventFilter = "all" | "court" | "depositions" | "deadlines" | "meetings" | "personal";

const FILTER_MAP: Record<EventFilter, string[]> = {
  all: [],
  court: ["court_hearing"],
  depositions: ["deposition"],
  deadlines: ["matter_deadline", "court_filing", "statute_tracker"],
  meetings: ["meeting"],
  personal: ["personal", "appointment"],
};

export default function MobileTravelCalendar() {
  const [view, setView] = useState<View>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPrefs, setShowPrefs] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<EventFilter>("all");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const dateStr = currentDate.toISOString().split("T")[0];
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
  }, [currentDate]);

  const dayView = trpc.travelCalendar.getDayView.useQuery({ date: dateStr });
  const weekView = trpc.travelCalendar.getWeekView.useQuery({ startDate: weekStart }, { enabled: view === "week" });
  const monthView = trpc.travelCalendar.getMonthView.useQuery(
    { month: currentDate.getMonth() + 1, year: currentDate.getFullYear() },
    { enabled: view === "month" }
  );
  const prefsQuery = trpc.travelCalendar.getTravelPreference.useQuery();
  const updatePrefs = trpc.travelCalendar.updateTravelPreference.useMutation();
  const addEvent = trpc.travelCalendar.addEvent.useMutation();
  const deleteEvent = trpc.travelCalendar.deleteEvent.useMutation();

  const navigate = useCallback((dir: number) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  }, [currentDate, view]);

  const goToday = () => setCurrentDate(new Date());

  // Filter events
  const filteredTimeline = useMemo(() => {
    const events = (dayView.data?.timelineEvents ?? dayView.data?.events ?? []) as any[];
    if (activeFilter === "all") return events;
    const types = FILTER_MAP[activeFilter];
    return events.filter((e: any) => types.includes(e.eventType));
  }, [dayView.data, activeFilter]);

  const filteredTravelSegments = useMemo(() => {
    const segments = (dayView.data?.travelSegments ?? []) as any[];
    if (activeFilter === "all") return segments;
    return segments;
  }, [dayView.data, activeFilter]);

  const allDayEvents = (dayView.data?.allDayEvents ?? []) as any[];
  const deadlineEvents = (dayView.data?.deadlineEvents ?? []) as any[];
  const conflictCount = dayView.data?.conflictCount ?? 0;

  // Find travel to/from selected event
  const travelTo = selectedEvent ? filteredTravelSegments.find((s: any) => s.toEvent?.id === selectedEvent.id) : null;
  const travelFrom = selectedEvent ? filteredTravelSegments.find((s: any) => s.fromEvent?.id === selectedEvent.id) : null;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await dayView.refetch();
      setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  };

  const handleSavePrefs = async (prefs: any) => {
    await updatePrefs.mutateAsync({ userId: "default", ...prefs });
    prefsQuery.refetch();
    setShowPrefs(false);
  };

  const handleAddEvent = async (data: any) => {
    await addEvent.mutateAsync(data);
    dayView.refetch();
    setShowAddEvent(false);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent.mutateAsync({ eventId: id });
    setSelectedEvent(null);
    dayView.refetch();
  };

  const headerLabel = view === "day"
    ? currentDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : view === "week"
    ? `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 safe-area-top">
        <div className="flex items-center justify-between">
          <Link href="/calendar" className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="text-center flex-1">
            <p className="text-sm font-semibold">{headerLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSync} className={`text-slate-400 hover:text-white ${syncing ? "animate-spin" : ""}`}>
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={() => setShowPrefs(true)} className="text-slate-400 hover:text-white">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 mt-2 bg-slate-800 rounded-lg p-1">
          {(["day", "week", "month"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-hide">
          {(["all", "court", "depositions", "deadlines", "meetings", "personal"] as EventFilter[]).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 text-[11px] font-medium rounded-full whitespace-nowrap transition-colors ${activeFilter === f ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-2">
          <button onClick={() => navigate(-1)} className="p-1 text-slate-400"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={goToday} className="text-xs text-blue-400 font-medium">Today</button>
          <button onClick={() => navigate(1)} className="p-1 text-slate-400"><ChevronRight className="h-5 w-5" /></button>
        </div>

        {/* Sync indicator */}
        {lastSync && (
          <p className="text-[10px] text-slate-600 text-center mt-1">
            Last synced: {lastSync.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>

      {/* Conflict Banner */}
      {conflictCount > 0 && view === "day" && (
        <div className="mx-4 mt-3 bg-red-900/50 border border-red-700 rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <p className="text-sm text-red-300">{conflictCount} scheduling conflict{conflictCount > 1 ? "s" : ""} today</p>
        </div>
      )}

      {/* Day View */}
      {view === "day" && (
        <DayTimelineView
          events={filteredTimeline}
          travelSegments={filteredTravelSegments}
          allDayEvents={allDayEvents}
          deadlineEvents={deadlineEvents}
          onEventTap={setSelectedEvent}
          isLoading={dayView.isLoading}
        />
      )}

      {/* Week View */}
      {view === "week" && (
        <WeekStripView
          currentDate={currentDate}
          onSelectDay={(d) => { setCurrentDate(d); setView("day"); }}
          weekData={weekView.data ? {
            days: weekView.data.days.map((d: any) => ({
              date: d.date,
              eventCount: d.eventCount || d.events?.length || 0,
              conflictCount: d.conflictCount || 0,
              hasDeadlines: d.hasDeadlines || false,
            }))
          } : undefined}
        />
      )}

      {/* Month View */}
      {view === "month" && (
        <MonthGridView
          currentDate={currentDate}
          onSelectDay={(d) => { setCurrentDate(d); setView("day"); }}
          monthData={monthView.data ? { days: monthView.data.days as any } : undefined}
        />
      )}

      {/* FAB - Add Event */}
      <button onClick={() => setShowAddEvent(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors">
        <Plus className="h-6 w-6 text-white" />
      </button>

      {/* Event Detail Sheet */}
      {selectedEvent && (
        <EventDetailSheet
          event={selectedEvent}
          travelTo={travelTo}
          travelFrom={travelFrom}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Preferences Modal */}
      {showPrefs && (
        <TravelPreferencesModal
          isOpen={showPrefs}
          onClose={() => setShowPrefs(false)}
          preferences={(prefsQuery.data as any) || { defaultMode: "driving", bufferMinutes: 15, alertThreshold: 30, geofenceBuffer: 10, autoSyncMatters: true, autoSyncCourt: true, homeAddress: "", officeAddress: "" }}
          onSave={handleSavePrefs}
          lastSyncTime={lastSync}
        />
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <AddEditEventModal
          isOpen={showAddEvent}
          onClose={() => setShowAddEvent(false)}
          onSave={handleAddEvent}
        />
      )}
    </div>
  );
}
