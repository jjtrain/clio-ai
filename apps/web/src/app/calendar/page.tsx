"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  List,
  Grid3X3,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// ─── Helpers ────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface CalendarItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  type: "appointment" | "matter" | "general";
  location?: string | null;
  matterId?: string | null;
  matterName?: string | null;
}

// ─── Day Detail Panel ───────────────────────────────────────────────

function DayDetailPanel({
  date,
  events,
  onClose,
}: {
  date: Date;
  events: CalendarItem[];
  onClose: () => void;
}) {
  const dayLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{dayLabel}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-gray-500 text-sm">No events on this day.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
            >
              <div
                className={`w-1 h-full min-h-[40px] rounded-full flex-shrink-0 ${
                  event.type === "appointment"
                    ? "bg-blue-500"
                    : event.type === "matter"
                      ? "bg-purple-500"
                      : "bg-gray-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {event.title}
                </p>
                <p className="text-sm text-gray-500">
                  {event.allDay
                    ? "All Day"
                    : `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`}
                </p>
                {event.location && (
                  <p className="text-xs text-gray-400 mt-1">{event.location}</p>
                )}
                {event.matterName && (
                  <p className="text-xs text-purple-500 mt-1">{event.matterName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Calendar Page ─────────────────────────────────────────────

export default function CalendarPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const today = new Date();

  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Calculate date range for the visible month
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
  const startDate = new Date(firstOfMonth);
  startDate.setDate(startDate.getDate() - firstOfMonth.getDay());
  const endDate = new Date(lastOfMonth);
  endDate.setDate(endDate.getDate() + (6 - lastOfMonth.getDay()));
  endDate.setHours(23, 59, 59, 999);

  // Queries
  const { data: eventsData, isLoading } = trpc.calendar.list.useQuery({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit: 100,
  });
  const { data: listData, isLoading: listLoading } = trpc.calendar.list.useQuery(
    {},
    { enabled: viewMode === "list" }
  );
  const { data: appointmentsData } = trpc.scheduler.listAppointments.useQuery({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit: 100,
  });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Event deleted" });
      utils.calendar.list.invalidate();
    },
  });

  // Combine events and appointments into CalendarItems
  const calendarItems: CalendarItem[] = useMemo(() => {
    const items: CalendarItem[] = [];

    // Calendar events
    if (eventsData?.events) {
      for (const e of eventsData.events) {
        items.push({
          id: e.id,
          title: e.title,
          startTime: new Date(e.startTime),
          endTime: new Date(e.endTime),
          allDay: e.allDay,
          type: e.matterId ? "matter" : "general",
          location: e.location,
          matterId: e.matter?.id,
          matterName: e.matter?.name,
        });
      }
    }

    // Appointments
    if (appointmentsData?.appointments) {
      for (const a of appointmentsData.appointments) {
        // Skip appointments that already have calendar events (avoid duplicates)
        if (a.calendarEventId && items.some((i) => i.id === a.calendarEventId)) {
          continue;
        }
        if (a.status === "CANCELLED") continue;
        items.push({
          id: `apt-${a.id}`,
          title: `Consultation: ${a.clientName}`,
          startTime: new Date(a.startTime),
          endTime: new Date(a.endTime),
          allDay: false,
          type: "appointment",
        });
      }
    }

    return items;
  }, [eventsData, appointmentsData]);

  // Build calendar grid
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [viewMonth, viewYear]);

  // Events for a specific day
  const getEventsForDay = (day: Date): CalendarItem[] => {
    return calendarItems.filter((item) => isSameDay(new Date(item.startTime), day));
  };

  // Navigation
  const goToToday = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setSelectedDay(null);
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // ─── Month View ─────────────────────────────────────────────────

  const renderMonthView = () => (
    <div>
      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Week Rows */}
        {calendarWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === viewMonth;
              const isToday = isSameDay(day, today);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const dayEvents = getEventsForDay(day);
              const maxPills = 3;
              const overflow = dayEvents.length - maxPills;

              return (
                <div
                  key={di}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[100px] md:min-h-[120px] p-1.5 cursor-pointer transition-colors border-r border-gray-100 last:border-r-0 ${
                    isToday
                      ? "bg-blue-50/50"
                      : isSelected
                        ? "bg-gray-50"
                        : "hover:bg-gray-50/50"
                  }`}
                >
                  {/* Day Number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={`inline-flex items-center justify-center text-sm w-7 h-7 rounded-full ${
                        isToday
                          ? "bg-blue-600 text-white font-bold"
                          : isCurrentMonth
                            ? "text-gray-900 font-medium"
                            : "text-gray-300"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Event Pills */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, maxPills).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${
                          event.type === "appointment"
                            ? "bg-blue-100 text-blue-700"
                            : event.type === "matter"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                        title={event.title}
                      >
                        {!event.allDay && (
                          <span className="font-medium">
                            {formatTime(event.startTime)}{" "}
                          </span>
                        )}
                        {event.title}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="text-xs text-gray-500 px-1.5 font-medium">
                        +{overflow} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected Day Detail Panel */}
      {selectedDay && (
        <DayDetailPanel
          date={selectedDay}
          events={selectedDayEvents}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );

  // ─── List View ──────────────────────────────────────────────────

  const renderListView = () => (
    <Card>
      <CardHeader>
        <CardTitle>All Events</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Matter</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : listData?.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No events found
                  </TableCell>
                </TableRow>
              ) : (
                listData?.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Link
                        href={"/calendar/" + event.id}
                        className="font-medium hover:underline"
                      >
                        {event.title}
                      </Link>
                      {event.allDay && (
                        <Badge variant="secondary" className="ml-2">
                          All Day
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.allDay
                        ? formatDate(event.startTime)
                        : formatDateTime(event.startTime)}
                    </TableCell>
                    <TableCell>
                      {event.matter ? (
                        <Link
                          href={"/matters/" + event.matter.id}
                          className="hover:underline"
                        >
                          {event.matter.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.location || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={"/calendar/" + event.id + "/edit"}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteEvent.mutate({ id: event.id })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {viewMode === "month" && (
            <>
              <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold min-w-[220px] text-center">
                {MONTHS[viewMonth]} {viewYear}
              </h1>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
          {viewMode === "list" && (
            <div>
              <h1 className="text-3xl font-bold">Calendar</h1>
              <p className="text-muted-foreground">
                Manage your schedule and deadlines
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "month" && (
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          )}
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-none"
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              Month
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
          <Button asChild>
            <Link href="/calendar/new">
              <Plus className="mr-2 h-4 w-4" />
              New Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading && viewMode === "month" ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : viewMode === "month" ? (
        renderMonthView()
      ) : (
        renderListView()
      )}
    </div>
  );
}
