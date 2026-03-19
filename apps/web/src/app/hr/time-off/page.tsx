"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  PartyPopper,
  AlertTriangle,
} from "lucide-react";

export default function TimeOffPage() {
  const [view, setView] = useState<"calendar" | "approvals">("calendar");

  const utils = trpc.useUtils();
  const { data: whoIsOut, isLoading } = trpc.hr["timeOff.getFirmCalendar"].useQuery({});
  const { data: pendingRequests } = trpc.hr["timeOff.list"].useQuery({ status: "PENDING" });
  const { data: holidays } = trpc.hr["timeOff.getHolidays"].useQuery({});
  const { data: staffingLevels } = trpc.hr["timeOff.getConflicts"].useQuery({});

  const approveMut = trpc.hr["timeOff.approve"].useMutation({
    onSuccess: () => {
      utils.hr["timeOff.list"].invalidate();
      utils.hr["timeOff.getFirmCalendar"].invalidate();
    },
  });
  const denyMut = trpc.hr["timeOff.deny"].useMutation({
    onSuccess: () => {
      utils.hr["timeOff.list"].invalidate();
    },
  });

  const outList: any[] = Array.isArray(whoIsOut) ? whoIsOut : (whoIsOut as any)?.days ?? [];
  const pending = pendingRequests ?? [];
  const holidayList = holidays ?? [];
  const staffing: any = staffingLevels ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Time Off</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage absences and staffing levels</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("calendar")}
            className={view === "calendar" ? "bg-blue-500 hover:bg-blue-600" : ""}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Calendar
          </Button>
          <Button
            variant={view === "approvals" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("approvals")}
            className={view === "approvals" ? "bg-blue-500 hover:bg-blue-600" : ""}
          >
            <Clock className="h-4 w-4 mr-1" />
            Approvals
            {pending.length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5">
                {pending.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Staffing Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">In Office Today</span>
            <Users className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{staffing.inOffice ?? "-"}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Out Today</span>
            <CalendarOff className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{outList.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Out This Week</span>
            <CalendarDays className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{staffing.outThisWeek ?? "-"}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Pending Requests</span>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
        </div>
      </div>

      {view === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Who's Out */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Who&apos;s Out</h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : outList.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p className="text-sm">No one is out today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {outList.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {entry.employee?.fullName ??
                          entry.employeeName ??
                          `${entry.employee?.firstName} ${entry.employee?.lastName}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.type} &mdash;{" "}
                        {new Date(entry.startDate).toLocaleDateString()} to{" "}
                        {new Date(entry.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700">{entry.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Firm Holidays */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Firm Holidays</h2>
            {holidayList.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400">
                <PartyPopper className="h-8 w-8 mb-2" />
                <p className="text-sm">No upcoming holidays</p>
              </div>
            ) : (
              <div className="space-y-3">
                {holidayList.map((hol: any, i: number) => (
                  <div key={hol.id ?? i} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{hol.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(hol.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <PartyPopper className="h-4 w-4 text-gray-300" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "approvals" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
                    No pending requests
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium text-gray-900">
                      {req.employee?.fullName ??
                        req.employeeName ??
                        `${req.employee?.firstName} ${req.employee?.lastName}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{req.type}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {new Date(req.startDate).toLocaleDateString()} &ndash;{" "}
                      {new Date(req.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-gray-700">{req.days ?? "-"}</TableCell>
                    <TableCell className="text-gray-500 text-sm max-w-[200px] truncate">
                      {req.notes ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:bg-green-50 border-green-200"
                          disabled={approveMut.isPending}
                          onClick={() => approveMut.mutate({ requestId: req.id })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 border-red-200"
                          disabled={denyMut.isPending}
                          onClick={() => denyMut.mutate({ requestId: req.id })}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
