"use client";

import { usePortal } from "../portal-context";
import { trpc } from "@/lib/trpc";
import { Calendar, MapPin, Clock } from "lucide-react";

export default function PortalAppointmentsPage() {
  const { token } = usePortal();
  const { data: appointments, isLoading } = trpc.clientPortal.portalGetAppointments.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  if (!token) return <div className="text-center py-12 text-gray-400">Please log in</div>;

  const now = new Date();
  const upcoming = appointments?.filter((a) => new Date(a.startTime) >= now) || [];
  const past = appointments?.filter((a) => new Date(a.startTime) < now) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-gray-500">View your scheduled appointments</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !appointments?.length ? (
        <div className="text-center py-12">
          <Calendar className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No appointments found</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((apt) => (
                  <div key={apt.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-semibold">{apt.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(apt.startTime).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(apt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {apt.endTime && ` - ${new Date(apt.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                      </span>
                      {apt.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {apt.location}
                        </span>
                      )}
                    </div>
                    {apt.matter && (
                      <p className="text-xs text-gray-400 mt-2">Related to: {apt.matter.name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3 text-gray-400">Past</h2>
              <div className="space-y-3">
                {past.map((apt) => (
                  <div key={apt.id} className="bg-gray-50 rounded-xl border border-gray-100 p-5 opacity-60">
                    <h3 className="font-semibold">{apt.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(apt.startTime).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(apt.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
