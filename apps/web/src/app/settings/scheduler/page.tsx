"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Mail,
  Bell,
  Code,
  Copy,
  Check,
  Link as LinkIcon,
  RefreshCw,
  Unplug,
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function SchedulerSettingsPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    }>
      <SchedulerSettingsPage />
    </Suspense>
  );
}

function SchedulerSettingsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();

  // Show Google connection status from redirect
  useEffect(() => {
    const googleStatus = searchParams.get("google");
    if (googleStatus === "connected") {
      toast({ title: "Google Calendar connected successfully" });
    } else if (googleStatus === "error") {
      const msg = searchParams.get("message") || "Failed to connect";
      toast({ title: "Google Calendar connection failed", description: msg, variant: "destructive" });
    }
  }, [searchParams]);

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
  const [sendReminders, setSendReminders] = useState(true);
  const [reminderHoursBefore, setReminderHoursBefore] = useState(24);
  const [secondReminderHours, setSecondReminderHours] = useState<number | null>(null);
  const [reminderEmailFrom, setReminderEmailFrom] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = trpc.scheduler.getSettings.useQuery();
  const { data: helcimStatus } = trpc.scheduler.helcimEnabled.useQuery();
  const { data: googleSync } = trpc.calendar.getGoogleSyncStatus.useQuery();

  const disconnectGoogle = trpc.calendar.disconnectGoogle.useMutation({
    onSuccess: () => {
      toast({ title: "Google Calendar disconnected" });
      utils.calendar.getGoogleSyncStatus.invalidate();
    },
  });

  const updateGoogleSync = trpc.calendar.updateGoogleSync.useMutation({
    onSuccess: () => {
      toast({ title: "Google Calendar sync settings updated" });
      utils.calendar.getGoogleSyncStatus.invalidate();
    },
  });

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
      setSendReminders(settings.sendReminders);
      setReminderHoursBefore(settings.reminderHoursBefore);
      setSecondReminderHours(settings.secondReminderHours ?? null);
      setReminderEmailFrom(settings.reminderEmailFrom || "");
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
      sendReminders,
      reminderHoursBefore,
      secondReminderHours: secondReminderHours || null,
      reminderEmailFrom: reminderEmailFrom || null,
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

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

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
              {baseUrl}/book
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

      {/* Email Reminders */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-50">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Email Reminders</h2>
            <p className="text-sm text-gray-500">
              Automatically remind clients about upcoming appointments
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Send Appointment Reminders</Label>
              <p className="text-sm text-gray-500">
                Email clients before their appointment
              </p>
            </div>
            <Switch checked={sendReminders} onCheckedChange={setSendReminders} />
          </div>

          {sendReminders && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Reminder (hours before)</Label>
                  <Input
                    type="number"
                    value={reminderHoursBefore}
                    onChange={(e) => setReminderHoursBefore(parseInt(e.target.value) || 24)}
                    min={1}
                    max={168}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Second Reminder (hours before, optional)</Label>
                  <Input
                    type="number"
                    value={secondReminderHours ?? ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setSecondReminderHours(isNaN(val) ? null : val);
                    }}
                    min={1}
                    max={168}
                    placeholder="None"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  From Email Address (optional)
                </Label>
                <Input
                  type="email"
                  value={reminderEmailFrom}
                  onChange={(e) => setReminderEmailFrom(e.target.value)}
                  placeholder="noreply@yourdomain.com"
                />
                <p className="text-xs text-gray-500">
                  Must be a verified sender in Resend. Leave blank for default.
                </p>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
                Reminders will be sent automatically once{" "}
                <code className="bg-gray-200 px-1 rounded">RESEND_API_KEY</code> is added
                to your environment variables.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Embed on Website */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-indigo-50">
            <Code className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Embed on Website</h2>
            <p className="text-sm text-gray-500">
              Add the booking widget to your website
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Script Tag (recommended)</Label>
            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border">
              <code className="text-sm text-gray-700 flex-1 break-all">
                {`<script src="${baseUrl}/widget/booking.js" data-target="#booking-container"></script>`}
              </code>
              <CopyButton
                text={`<script src="${baseUrl}/widget/booking.js" data-target="#booking-container"></script>`}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">iFrame Embed</Label>
            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border">
              <code className="text-sm text-gray-700 flex-1 break-all">
                {`<iframe src="${baseUrl}/book?embed=true" width="100%" height="700" frameborder="0"></iframe>`}
              </code>
              <CopyButton
                text={`<iframe src="${baseUrl}/book?embed=true" width="100%" height="700" frameborder="0"></iframe>`}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Direct Link</Label>
            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border">
              <code className="text-sm text-gray-700 flex-1 break-all">
                {`${baseUrl}/book`}
              </code>
              <CopyButton text={`${baseUrl}/book`} />
            </div>
          </div>
        </div>
      </div>

      {/* Google Calendar Sync */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-red-50">
            <Calendar className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Google Calendar Sync</h2>
            <p className="text-sm text-gray-500">
              Sync events with your Google Calendar
            </p>
          </div>
        </div>

        {googleSync?.isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">
                Google Calendar connected
              </span>
              {googleSync.lastSyncAt && (
                <span className="text-xs text-green-600 ml-auto">
                  Last synced: {new Date(googleSync.lastSyncAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label>Sync Direction</Label>
              <div className="flex gap-2">
                {(["both", "to_google", "from_google"] as const).map((dir) => (
                  <Button
                    key={dir}
                    variant={googleSync.syncDirection === dir ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateGoogleSync.mutate({ syncDirection: dir })}
                  >
                    {dir === "both" ? "Two-Way" : dir === "to_google" ? "To Google" : "From Google"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Sync</Label>
                </div>
                <Switch
                  checked={googleSync.isEnabled}
                  onCheckedChange={(checked) =>
                    updateGoogleSync.mutate({ isEnabled: checked })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => disconnectGoogle.mutate()}
                disabled={disconnectGoogle.isPending}
              >
                <Unplug className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Connect your Google Calendar to automatically sync events.
            </p>
            <Button
              asChild
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <a href="/api/google/auth">
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google Calendar
              </a>
            </Button>
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
              Google Calendar sync will work once{" "}
              <code className="bg-gray-200 px-1 rounded">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="bg-gray-200 px-1 rounded">GOOGLE_CLIENT_SECRET</code> are
              added to your environment variables.
            </div>
          </div>
        )}
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
