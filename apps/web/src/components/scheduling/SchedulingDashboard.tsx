"use client";

import { CalendarCheck, Clock, Users, XCircle, AlertTriangle, Video, MapPin, Phone, CheckCircle, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; icon: any }> = {
  confirmed: { color: "bg-green-100 text-green-700", icon: CheckCircle },
  pending: { color: "bg-yellow-100 text-yellow-700", icon: Clock },
  in_progress: { color: "bg-blue-100 text-blue-700", icon: Play },
  completed: { color: "bg-gray-100 text-gray-600", icon: CheckCircle },
  cancelled: { color: "bg-red-100 text-red-500", icon: XCircle },
  no_show: { color: "bg-orange-100 text-orange-600", icon: AlertTriangle },
};

const locationIcons: Record<string, any> = { in_person: MapPin, virtual: Video, phone: Phone };

export function SchedulingDashboard() {
  const { data: stats } = trpc.appointmentScheduling.getSchedulingStats.useQuery();
  const { data: todaysAppts } = trpc.appointmentScheduling.getTodaysAppointments.useQuery();
  const { data: upcoming } = trpc.appointmentScheduling.getUpcoming.useQuery({ limit: 5 });

  const completeMutation = trpc.appointmentScheduling.completeAppointment.useMutation();
  const noShowMutation = trpc.appointmentScheduling.markNoShow.useMutation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarCheck className="h-7 w-7 text-blue-600" />
          Scheduling
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage appointments, availability, and client bookings</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.upcoming}</p>
            <p className="text-xs text-gray-500">Upcoming</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.completionRate}%</p>
            <p className="text-xs text-gray-500">Completion Rate</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.noShows}</p>
            <p className="text-xs text-gray-500">No-Shows</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Appointments</p>
          </Card>
        </div>
      )}

      {/* Today's Schedule */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          Today&apos;s Schedule
        </h2>
        {todaysAppts && todaysAppts.length > 0 ? (
          <div className="space-y-2">
            {todaysAppts.map((appt) => {
              const sc = statusConfig[appt.status] || statusConfig.confirmed;
              const LocIcon = locationIcons[appt.locationType] || MapPin;
              return (
                <Card key={appt.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center w-16">
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(appt.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="text-[10px] text-gray-400">{appt.duration} min</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{appt.clientName}</p>
                        <Badge className={cn("text-[10px]", sc.color)}>{appt.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <LocIcon className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{appt.type?.name}</span>
                        {appt.type?.color && <div className="h-2 w-2 rounded-full" style={{ backgroundColor: appt.type.color }} />}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {appt.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => completeMutation.mutate({ appointmentId: appt.id })} className="text-xs h-7">
                        Complete
                      </Button>
                    )}
                    {appt.meetingUrl && (
                      <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="text-xs h-7 gap-1"><Video className="h-3 w-3" />Join</Button>
                      </a>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <CalendarCheck className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No appointments today</p>
          </Card>
        )}
      </div>

      {/* Upcoming */}
      {upcoming && upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Upcoming This Week</h2>
          <div className="space-y-1.5">
            {upcoming.map((appt) => (
              <Card key={appt.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 w-24">
                    {new Date(appt.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(appt.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{appt.clientName}</span>
                  <span className="text-xs text-gray-400">{appt.type?.name}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
