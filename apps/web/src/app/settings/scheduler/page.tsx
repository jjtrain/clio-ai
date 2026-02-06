"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Save,
  Plus,
  Trash2,
  Settings,
} from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export default function SchedulerSettingsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [consultationDuration, setConsultationDuration] = useState(30);
  const [consultationFee, setConsultationFee] = useState(150);
  const [bufferTime, setBufferTime] = useState(15);
  const [minAdvanceBooking, setMinAdvanceBooking] = useState(24);
  const [maxAdvanceBooking, setMaxAdvanceBooking] = useState(30);
  const [preventSameDayBooking, setPreventSameDayBooking] = useState(true);
  const [requirePaymentUpfront, setRequirePaymentUpfront] = useState(true);
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [newPracticeArea, setNewPracticeArea] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = trpc.scheduler.getSettings.useQuery();
  const { data: helcimStatus } = trpc.scheduler.helcimEnabled.useQuery();

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.isEnabled);
      setAvailability(settings.availability || []);
      setConsultationDuration(settings.consultationDuration);
      setConsultationFee(settings.consultationFee);
      setBufferTime(settings.bufferTime);
      setMinAdvanceBooking(settings.minAdvanceBooking);
      setMaxAdvanceBooking(settings.maxAdvanceBooking);
      setPreventSameDayBooking(settings.preventSameDayBooking);
      setRequirePaymentUpfront(settings.requirePaymentUpfront);
      setPracticeAreas(settings.practiceAreas || []);
      setConfirmationMessage(settings.confirmationMessage || "");
    }
  }, [settings]);

  const updateSettings = trpc.scheduler.updateSettings.useMutation({
    onSuccess: () => {
      toast({ title: "Scheduler settings saved" });
      utils.scheduler.getSettings.invalidate();
      setIsSaving(false);
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const handleSave = () => {
    setIsSaving(true);
    updateSettings.mutate({
      isEnabled,
      availability,
      consultationDuration,
      consultationFee,
      bufferTime,
      minAdvanceBooking,
      maxAdvanceBooking,
      preventSameDayBooking,
      requirePaymentUpfront,
      practiceAreas,
      confirmationMessage,
    });
  };

  const toggleDayAvailability = (dayOfWeek: number, checked: boolean) => {
    if (checked) {
      setAvailability([
        ...availability,
        { dayOfWeek, startTime: "09:00", endTime: "17:00" },
      ]);
    } else {
      setAvailability(availability.filter((a) => a.dayOfWeek !== dayOfWeek));
    }
  };

  const updateDayTimes = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setAvailability(
      availability.map((a) =>
        a.dayOfWeek === dayOfWeek ? { ...a, [field]: value } : a
      )
    );
  };

  const addPracticeArea = () => {
    if (newPracticeArea.trim() && !practiceAreas.includes(newPracticeArea.trim())) {
      setPracticeAreas([...practiceAreas, newPracticeArea.trim()]);
      setNewPracticeArea("");
    }
  };

  const removePracticeArea = (area: string) => {
    setPracticeAreas(practiceAreas.filter((a) => a !== area));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Appointment Scheduler
          </h1>
          <p className="text-gray-500 mt-1">
            Configure online booking for client consultations
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-500 hover:bg-blue-600"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Online Booking
              </h2>
              <p className="text-sm text-gray-500">
                Allow prospective clients to book consultations online
              </p>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
        {isEnabled && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            Booking page available at:{" "}
            <code className="bg-blue-100 px-2 py-0.5 rounded">
              {typeof window !== "undefined" ? window.location.origin : ""}/book
            </code>
          </div>
        )}
      </div>

      {/* Consultation Settings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-50">
            <Settings className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Consultation Settings
            </h2>
            <p className="text-sm text-gray-500">
              Configure duration, pricing, and booking rules
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Consultation Duration (minutes)
            </Label>
            <Input
              type="number"
              value={consultationDuration}
              onChange={(e) => setConsultationDuration(parseInt(e.target.value) || 30)}
              min={15}
              max={180}
              step={15}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              Consultation Fee ($)
            </Label>
            <Input
              type="number"
              value={consultationFee}
              onChange={(e) => setConsultationFee(parseFloat(e.target.value) || 0)}
              min={0}
              step={0.01}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Buffer Time Between Appointments (minutes)
            </Label>
            <Input
              type="number"
              value={bufferTime}
              onChange={(e) => setBufferTime(parseInt(e.target.value) || 0)}
              min={0}
              max={60}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Minimum Advance Booking (hours)</Label>
            <Input
              type="number"
              value={minAdvanceBooking}
              onChange={(e) => setMinAdvanceBooking(parseInt(e.target.value) || 0)}
              min={0}
            />
            <p className="text-xs text-gray-500">
              How much notice clients must give
            </p>
          </div>

          <div className="space-y-2">
            <Label>Maximum Advance Booking (days)</Label>
            <Input
              type="number"
              value={maxAdvanceBooking}
              onChange={(e) => setMaxAdvanceBooking(parseInt(e.target.value) || 30)}
              min={1}
              max={365}
            />
            <p className="text-xs text-gray-500">
              How far in advance clients can book
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Prevent Same-Day Booking</Label>
              <p className="text-sm text-gray-500">
                Require at least one day notice
              </p>
            </div>
            <Switch
              checked={preventSameDayBooking}
              onCheckedChange={setPreventSameDayBooking}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Require Payment Upfront</Label>
              <p className="text-sm text-gray-500">
                Collect payment before confirming appointment
              </p>
            </div>
            <Switch
              checked={requirePaymentUpfront}
              onCheckedChange={setRequirePaymentUpfront}
            />
          </div>

          {requirePaymentUpfront && !helcimStatus?.enabled && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-700">
              Payment integration is not configured. Add Helcim credentials in
              Settings to enable online payments.
            </div>
          )}
        </div>
      </div>

      {/* Weekly Availability */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-50">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Weekly Availability
            </h2>
            <p className="text-sm text-gray-500">
              Set your available hours for each day
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day) => {
            const dayAvail = availability.find((a) => a.dayOfWeek === day.value);
            return (
              <div
                key={day.value}
                className="flex items-center gap-4 p-3 border rounded-lg"
              >
                <Checkbox
                  checked={!!dayAvail}
                  onCheckedChange={(checked) =>
                    toggleDayAvailability(day.value, !!checked)
                  }
                />
                <span className="w-24 font-medium text-gray-700">{day.label}</span>
                {dayAvail ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayAvail.startTime}
                      onChange={(e) =>
                        updateDayTimes(day.value, "startTime", e.target.value)
                      }
                      className="w-32"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="time"
                      value={dayAvail.endTime}
                      onChange={(e) =>
                        updateDayTimes(day.value, "endTime", e.target.value)
                      }
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-gray-400">Not available</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Practice Areas */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-50">
            <Settings className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Practice Areas</h2>
            <p className="text-sm text-gray-500">
              Areas of law offered for consultations
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {practiceAreas.map((area) => (
            <div
              key={area}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
            >
              <span>{area}</span>
              <button
                type="button"
                onClick={() => removePracticeArea(area)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add practice area..."
            value={newPracticeArea}
            onChange={(e) => setNewPracticeArea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPracticeArea())}
          />
          <Button type="button" variant="outline" onClick={addPracticeArea}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation Message */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-50">
            <Settings className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Confirmation Message
            </h2>
            <p className="text-sm text-gray-500">
              Custom message shown after booking
            </p>
          </div>
        </div>

        <Textarea
          placeholder="Thank you for booking a consultation. We look forward to speaking with you..."
          value={confirmationMessage}
          onChange={(e) => setConfirmationMessage(e.target.value)}
          rows={4}
        />
      </div>

      {/* Save Button (bottom) */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-500 hover:bg-blue-600"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
