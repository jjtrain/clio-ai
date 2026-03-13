"use client";

import { Suspense, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useHelcim } from "@/lib/use-helcim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  User,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  practiceArea: string;
  description: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

// ─── Helpers ─────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ─── Step Indicator ──────────────────────────────────────────────────

function StepIndicator({
  current,
  hasPayment,
}: {
  current: Step;
  hasPayment: boolean;
}) {
  const steps = hasPayment
    ? [
        { num: 1, label: "Date" },
        { num: 2, label: "Time" },
        { num: 3, label: "Details" },
        { num: 4, label: "Payment" },
        { num: 5, label: "Confirmed" },
      ]
    : [
        { num: 1, label: "Date" },
        { num: 2, label: "Time" },
        { num: 3, label: "Details" },
        { num: 5, label: "Confirmed" },
      ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              current === s.num
                ? "bg-blue-500 text-white"
                : current > s.num
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {current > s.num ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              i + 1
            )}
          </div>
          <span
            className={`text-sm hidden sm:inline ${
              current === s.num
                ? "text-blue-600 font-medium"
                : current > s.num
                  ? "text-blue-400"
                  : "text-gray-400"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-px ${
                current > s.num ? "bg-blue-300" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────

export default function BookingPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    }>
      <BookingPage />
    </Suspense>
  );
}

function BookingPage() {
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get("embed") === "true";
  const hideHeader = searchParams.get("hideHeader") === "true";

  const [step, setStep] = useState<Step>(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    practiceArea: "",
    description: "",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [error, setError] = useState<string | null>(null);

  // Calendar nav state
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  // Notify parent iframe of height changes for embed mode
  useEffect(() => {
    if (!isEmbed) return;
    const observer = new ResizeObserver(() => {
      window.parent.postMessage(
        { type: "clio-booking-resize", height: document.body.scrollHeight },
        "*"
      );
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isEmbed]);

  // Queries
  const { data: settings, isLoading: settingsLoading } =
    trpc.scheduler.getSettings.useQuery();
  const { data: firmInfo } = trpc.users.getFirmInfo.useQuery();

  const { data: slotsData, isLoading: slotsLoading } =
    trpc.scheduler.getAvailableSlots.useQuery(
      { date: selectedDate?.toISOString() ?? "" },
      { enabled: !!selectedDate && step === 2 }
    );

  // Mutations
  const createAppointment = trpc.scheduler.createAppointment.useMutation();
  const initializePayment = trpc.scheduler.initializePayment.useMutation();
  const confirmPayment = trpc.scheduler.confirmPayment.useMutation();

  // Helcim
  const helcim = useHelcim({
    onSuccess: async (result) => {
      if (!appointmentId) return;
      try {
        const confirmed = await confirmPayment.mutateAsync({
          appointmentId,
          transactionId: result.transactionId,
          hash: result.hash,
          rawResponse: result.rawResponse,
        });
        setAppointmentDetails(confirmed);
        setStep(5);
      } catch (e: any) {
        setError(e.message || "Payment confirmation failed");
      }
    },
    onError: (errMsg) => {
      setError(errMsg || "Payment failed. Please try again.");
    },
    onClose: () => {
      // User closed the payment modal without completing
    },
  });

  // ─── Derived data ──────────────────────────────────────────────────

  const availability: AvailabilitySlot[] = settings?.availability ?? [];
  const availableDays = useMemo(
    () => new Set(availability.map((a) => a.dayOfWeek)),
    [availability]
  );

  const practiceAreas: string[] = settings?.practiceAreas ?? [];

  // ─── Calendar Logic ────────────────────────────────────────────────

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(viewYear, viewMonth, d));
    }
    return days;
  }, [viewMonth, viewYear]);

  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      if (!settings) return true;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      // Past dates
      if (dateOnly < today) return true;

      // Day of week not in availability
      if (!availableDays.has(date.getDay())) return true;

      // Same-day prevention
      if (settings.preventSameDayBooking && isSameDay(date, now)) return true;

      // Min advance booking (hours)
      const minMs = settings.minAdvanceBooking * 60 * 60 * 1000;
      if (date.getTime() - now.getTime() < minMs) return true;

      // Max advance booking (days)
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + settings.maxAdvanceBooking);
      if (dateOnly > maxDate) return true;

      return false;
    },
    [settings, availableDays]
  );

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Don't allow navigating to past months
  const now = new Date();
  const canGoPrev = viewYear > now.getFullYear() || viewMonth > now.getMonth();

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleDateSelect = (date: Date) => {
    if (isDateDisabled(date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep(2);
  };

  const handleSlotSelect = (slotTime: string) => {
    setSelectedSlot(slotTime);
    setStep(3);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email";
    }
    if (!formData.phone.trim()) errors.phone = "Phone number is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async () => {
    if (!validateForm() || !selectedSlot) return;
    setError(null);

    try {
      const appointment = await createAppointment.mutateAsync({
        startTime: selectedSlot,
        clientName: formData.name,
        clientEmail: formData.email,
        clientPhone: formData.phone,
        practiceArea: formData.practiceArea || undefined,
        notes: formData.description || undefined,
      });

      setAppointmentId(appointment.id);
      setAppointmentDetails(appointment);

      if (settings?.requirePaymentUpfront) {
        setStep(4);
      } else {
        setStep(5);
      }
    } catch (e: any) {
      setError(e.message || "Failed to create appointment");
    }
  };

  const handlePayment = async () => {
    if (!appointmentId) return;
    setError(null);

    try {
      const { checkoutToken } = await initializePayment.mutateAsync({
        appointmentId,
      });
      helcim.openCheckout(checkoutToken);
    } catch (e: any) {
      setError(e.message || "Failed to initialize payment");
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedDate(null);
    setSelectedSlot(null);
    setAppointmentId(null);
    setAppointmentDetails(null);
    setFormData({ name: "", email: "", phone: "", practiceArea: "", description: "" });
    setFormErrors({});
    setError(null);
  };

  // ─── Loading State ─────────────────────────────────────────────────

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!settings?.isEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 max-w-md text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Online Booking Unavailable
          </h1>
          <p className="text-gray-500">
            Online appointment scheduling is not currently available. Please
            contact the office directly to schedule a consultation.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen py-8 px-4 ${isEmbed ? "bg-transparent" : "bg-slate-50"}`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        {!hideHeader && !isEmbed && (
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              {firmInfo?.firmName || "Book a Consultation"}
            </h1>
            {firmInfo?.firmName && (
              <p className="text-gray-500 mt-1">Book a Consultation</p>
            )}
          </div>
        )}

        {/* Step Indicator */}
        <StepIndicator
          current={step}
          hasPayment={!!settings.requirePaymentUpfront}
        />

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Step 1: Date Selection ── */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-50">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Select a Date
                </h2>
                <p className="text-sm text-gray-500">
                  Choose a day for your {settings.consultationDuration}-minute
                  consultation
                </p>
              </div>
            </div>

            {/* Calendar Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPrevMonth}
                disabled={!canGoPrev}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-base font-medium text-gray-900">
                {MONTHS[viewMonth]} {viewYear}
              </h3>
              <button
                onClick={goToNextMonth}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_HEADERS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-gray-500 py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, i) => {
                if (!date) {
                  return <div key={`pad-${i}`} className="h-10" />;
                }
                const disabled = isDateDisabled(date);
                const isToday = isSameDay(date, now);
                const isSelected =
                  selectedDate && isSameDay(date, selectedDate);

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateSelect(date)}
                    disabled={disabled}
                    className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-blue-500 text-white"
                        : disabled
                          ? "text-gray-300 cursor-not-allowed"
                          : isToday
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Fee info */}
            {settings.consultationFee > 0 && (
              <div className="mt-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 text-center">
                Consultation fee: ${settings.consultationFee.toFixed(2)} for{" "}
                {settings.consultationDuration} minutes
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Time Selection ── */}
        {step === 2 && selectedDate && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-50">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Select a Time
                </h2>
                <p className="text-sm text-gray-500">
                  {formatDate(selectedDate)}
                </p>
              </div>
            </div>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : slotsData?.message ? (
              <div className="text-center py-8 text-gray-500">
                {slotsData.message}
              </div>
            ) : slotsData?.slots.filter((s) => s.available).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No available time slots for this date. Please select another
                date.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slotsData?.slots
                  .filter((s) => s.available)
                  .map((slot) => {
                    const slotEnd = new Date(
                      new Date(slot.time).getTime() +
                        settings.consultationDuration * 60 * 1000
                    );
                    return (
                      <button
                        key={slot.time}
                        onClick={() => handleSlotSelect(slot.time)}
                        className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                          selectedSlot === slot.time
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700"
                        }`}
                      >
                        {formatTime(slot.time)} -{" "}
                        {formatTime(slotEnd.toISOString())}
                      </button>
                    );
                  })}
              </div>
            )}

            <div className="mt-6">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="text-gray-500"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Calendar
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Client Info Form ── */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-green-50">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Your Information
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedDate && formatDate(selectedDate)} at{" "}
                  {selectedSlot && formatTime(selectedSlot)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                {formErrors.email && (
                  <p className="text-sm text-red-500">{formErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
                {formErrors.phone && (
                  <p className="text-sm text-red-500">{formErrors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="practiceArea">Matter Type</Label>
                <Select
                  value={formData.practiceArea}
                  onValueChange={(val) =>
                    setFormData({ ...formData, practiceArea: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a practice area" />
                  </SelectTrigger>
                  <SelectContent>
                    {practiceAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">
                  Brief Description of Your Matter
                </Label>
                <Textarea
                  id="description"
                  placeholder="Please provide a brief description of your legal matter..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                className="text-gray-500"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleFormSubmit}
                disabled={createAppointment.isPending}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {createAppointment.isPending
                  ? "Booking..."
                  : settings.requirePaymentUpfront
                    ? "Continue to Payment"
                    : "Book Appointment"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Payment ── */}
        {step === 4 && appointmentId && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-amber-50">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Payment
                </h2>
                <p className="text-sm text-gray-500">
                  Complete payment to confirm your appointment
                </p>
              </div>
            </div>

            {/* Appointment Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-900 font-medium">
                  {selectedDate && formatDate(selectedDate)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time</span>
                <span className="text-gray-900 font-medium">
                  {selectedSlot && formatTime(selectedSlot)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duration</span>
                <span className="text-gray-900 font-medium">
                  {settings.consultationDuration} minutes
                </span>
              </div>
              {formData.practiceArea && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Practice Area</span>
                  <span className="text-gray-900 font-medium">
                    {formData.practiceArea}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">
                    Consultation Fee
                  </span>
                  <span className="font-semibold text-gray-900">
                    ${settings.consultationFee.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={handlePayment}
              disabled={
                initializePayment.isPending ||
                helcim.isProcessing ||
                confirmPayment.isPending
              }
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              {initializePayment.isPending
                ? "Preparing Payment..."
                : helcim.isProcessing
                  ? "Processing Payment..."
                  : confirmPayment.isPending
                    ? "Confirming..."
                    : `Pay $${settings.consultationFee.toFixed(2)}`}
            </Button>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400">
                Secure payment processed by Helcim
              </p>
            </div>
          </div>
        )}

        {/* ── Step 5: Confirmation ── */}
        {step === 5 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-green-50">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Appointment Confirmed!
            </h2>
            <p className="text-gray-500 mb-6">
              Your consultation has been booked successfully.
            </p>

            {/* Appointment Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-900 font-medium">
                  {selectedDate && formatDate(selectedDate)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time</span>
                <span className="text-gray-900 font-medium">
                  {selectedSlot && formatTime(selectedSlot)}
                  {selectedSlot && settings && (
                    <>
                      {" - "}
                      {formatTime(
                        new Date(
                          new Date(selectedSlot).getTime() +
                            settings.consultationDuration * 60 * 1000
                        ).toISOString()
                      )}
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Duration</span>
                <span className="text-gray-900 font-medium">
                  {settings.consultationDuration} minutes
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Name</span>
                <span className="text-gray-900 font-medium">
                  {formData.name}
                </span>
              </div>
              {formData.practiceArea && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Practice Area</span>
                  <span className="text-gray-900 font-medium">
                    {formData.practiceArea}
                  </span>
                </div>
              )}
              {appointmentDetails?.paymentStatus === "PAID" && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment</span>
                  <span className="text-green-600 font-medium">Paid</span>
                </div>
              )}
            </div>

            {/* Confirmation Message */}
            {settings.confirmationMessage && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm text-blue-700 text-left">
                {settings.confirmationMessage}
              </div>
            )}

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full"
            >
              Book Another Consultation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
