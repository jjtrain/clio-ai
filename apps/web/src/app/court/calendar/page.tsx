"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  Calendar,
  Gavel,
  Clock,
  MapPin,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Save,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const EVENT_TYPE_COLORS: Record<string, string> = {
  HEARING: "bg-blue-100 text-blue-800 border-blue-300",
  FILING_DEADLINE: "bg-red-100 text-red-800 border-red-300",
  CONFERENCE: "bg-purple-100 text-purple-800 border-purple-300",
  TRIAL: "bg-orange-100 text-orange-800 border-orange-300",
  MOTION: "bg-yellow-100 text-yellow-800 border-yellow-300",
  JUDGMENT: "bg-green-100 text-green-800 border-green-300",
  ORDER: "bg-teal-100 text-teal-800 border-teal-300",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  HEARING: "Hearing",
  FILING_DEADLINE: "Filing Deadline",
  CONFERENCE: "Conference",
  TRIAL: "Trial",
  MOTION: "Motion",
  JUDGMENT: "Judgment",
  ORDER: "Order",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  CONTINUED: "bg-yellow-50 text-yellow-700",
};

export default function CourtCalendarPage() {
  const [filterType, setFilterType] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  // Compute date range from viewMonth
  const [vy, vm] = viewMonth.split("-").map(Number);
  const startDate = new Date(vy, vm - 1, 1).toISOString();
  const endDate = new Date(vy, vm, 0, 23, 59, 59).toISOString();

  const eventsQuery = trpc.courtCalendar.listEvents.useQuery({
    startDate,
    endDate,
    eventType: filterType !== "all" ? filterType : undefined,
  });
  const addMut = trpc.courtCalendar.addManualEvent.useMutation({
    onSuccess: () => { eventsQuery.refetch(); setShowAddForm(false); },
  });

  const events = eventsQuery.data || [];

  // Group events by date
  const grouped: Record<string, typeof events> = {};
  for (const ev of events) {
    const dateKey = new Date(ev.scheduledAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(ev);
  }

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("HEARING");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formCourt, setFormCourt] = useState("");
  const [formJudge, setFormJudge] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formCase, setFormCase] = useState("");
  const [formNotes, setFormNotes] = useState("");

  function handleAdd() {
    if (!formTitle || !formDate) return;
    const scheduledAt = new Date(`${formDate}T${formTime}`).toISOString();
    addMut.mutate({
      title: formTitle,
      eventType: formType,
      scheduledAt,
      courtName: formCourt || undefined,
      judgeAssigned: formJudge || undefined,
      location: formLocation || undefined,
      caseNumber: formCase || undefined,
      notes: formNotes || undefined,
    });
  }

  function prevMonth() {
    const d = new Date(vy, vm - 2, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const d = new Date(vy, vm, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = new Date(vy, vm - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gavel className="h-7 w-7 text-indigo-600" />
            Court Calendar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            All court events across your matters
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-1" /> Add Event
          </Button>
        </div>
      </div>

      {/* Filters + Month Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-gray-700 w-[160px] text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="p-4 border-indigo-200 bg-indigo-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-800">New Court Event</h3>
            <button onClick={() => setShowAddForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Event title *" className="h-8 text-sm" />
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-8 text-sm" />
            <Input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="h-8 text-sm" />
            <Input value={formCourt} onChange={(e) => setFormCourt(e.target.value)} placeholder="Court name" className="h-8 text-sm" />
            <Input value={formJudge} onChange={(e) => setFormJudge(e.target.value)} placeholder="Judge assigned" className="h-8 text-sm" />
            <Input value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Location" className="h-8 text-sm" />
            <Input value={formCase} onChange={(e) => setFormCase(e.target.value)} placeholder="Case number" className="h-8 text-sm" />
          </div>
          <Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Notes (optional)" className="h-8 text-sm" />
          <Button size="sm" onClick={handleAdd} disabled={!formTitle || !formDate || addMut.isLoading}>
            {addMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            Save Event
          </Button>
        </Card>
      )}

      {/* Events List */}
      {Object.keys(grouped).length === 0 && !eventsQuery.isLoading && (
        <Card className="p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No court events in {monthLabel}</p>
        </Card>
      )}

      {Object.entries(grouped).map(([dateLabel, dayEvents]) => (
        <div key={dateLabel}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{dateLabel}</h3>
          <div className="space-y-2">
            {dayEvents.map((ev) => {
              const isPast = new Date(ev.scheduledAt) < new Date();
              const typeColor = EVENT_TYPE_COLORS[ev.eventType] || "bg-gray-100 text-gray-800";
              return (
                <Card key={ev.id} className={cn("p-4 border-l-4", isPast && ev.status === "SCHEDULED" ? "border-l-red-400 bg-red-50/30" : `border-l-indigo-400`)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-[10px]", typeColor)}>
                          {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                        </Badge>
                        <Badge className={cn("text-[10px]", STATUS_COLORS[ev.status] || "")}>
                          {ev.status}
                        </Badge>
                        {ev.source !== "MANUAL" && (
                          <Badge variant="outline" className="text-[9px]">{ev.source}</Badge>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 mt-1">{ev.title}</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ev.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        {ev.courtName && <span className="flex items-center gap-1"><Gavel className="h-3 w-3" />{ev.courtName}</span>}
                        {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.location}</span>}
                        {ev.judgeAssigned && <span>Judge: {ev.judgeAssigned}</span>}
                        {ev.caseNumber && <span>Case: {ev.caseNumber}</span>}
                      </div>
                      {ev.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ev.notes}</p>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
