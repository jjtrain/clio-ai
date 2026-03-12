"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  CalendarCheck,
  Clock,
  User,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  XCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type StatusFilter = "ALL" | "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  COMPLETED: "bg-blue-100 text-blue-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  UNPAID: "bg-amber-50 text-amber-600",
  PAID: "bg-green-50 text-green-600",
  REFUNDED: "bg-gray-50 text-gray-500",
};

const PAGE_SIZE = 20;

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AppointmentsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.scheduler.listAppointments.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: schedulerSettings } = trpc.scheduler.getSettings.useQuery();

  const updateStatus = trpc.scheduler.updateAppointmentStatus.useMutation({
    onSuccess: () => {
      toast({ title: "Appointment updated" });
      utils.scheduler.listAppointments.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error updating appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = (id: string) => {
    updateStatus.mutate({ id, status: "CONFIRMED" });
  };

  const handleCancel = (id: string) => {
    updateStatus.mutate({ id, status: "CANCELLED" });
  };

  const appointments = data?.appointments ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const bookingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/book`
      : "/book";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Appointments</h1>
          <p className="text-gray-500 mt-1">
            Manage client consultation bookings
          </p>
        </div>
        {schedulerSettings?.isEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Booking page:</span>
            <Link
              href="/book"
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              /book
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === status
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {status === "ALL" ? "All" : status === "NO_SHOW" ? "No Show" : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          )
        )}
      </div>

      {/* Appointments List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <CalendarCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            No Appointments
          </h2>
          <p className="text-gray-500 mb-4">
            {statusFilter === "ALL"
              ? "No appointments have been booked yet."
              : `No ${statusFilter.toLowerCase()} appointments found.`}
          </p>
          {schedulerSettings?.isEnabled && (
            <p className="text-sm text-gray-400">
              Share your booking page at{" "}
              <code className="bg-gray-100 px-2 py-0.5 rounded">
                {bookingUrl}
              </code>{" "}
              with clients.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt: any) => (
            <div
              key={apt.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                {/* Left: appointment info */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {apt.clientName}
                    </span>
                    <Badge
                      className={`text-xs ${STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-600"}`}
                    >
                      {apt.status === "NO_SHOW" ? "No Show" : apt.status.charAt(0) + apt.status.slice(1).toLowerCase()}
                    </Badge>
                    <Badge
                      className={`text-xs ${PAYMENT_COLORS[apt.paymentStatus] || ""}`}
                    >
                      {apt.paymentStatus.charAt(0) + apt.paymentStatus.slice(1).toLowerCase()}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      {formatDate(apt.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(apt.startTime)} - {formatTime(apt.endTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {apt.clientEmail}
                    </span>
                    {apt.clientPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {apt.clientPhone}
                      </span>
                    )}
                  </div>

                  {apt.practiceArea && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium text-gray-700">Practice Area:</span>{" "}
                      {apt.practiceArea}
                    </p>
                  )}
                  {apt.notes && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      <span className="font-medium text-gray-700">Notes:</span>{" "}
                      {apt.notes}
                    </p>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {apt.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(apt.id)}
                        disabled={updateStatus.isPending}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(apt.id)}
                        disabled={updateStatus.isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </>
                  )}
                  {apt.status === "CONFIRMED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancel(apt.id)}
                      disabled={updateStatus.isPending}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {page * PAGE_SIZE + 1}-
            {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
