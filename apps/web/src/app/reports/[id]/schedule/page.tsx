"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Save,
  CalendarClock,
  Mail,
  Plus,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";

export default function ReportSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [isScheduled, setIsScheduled] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [recipients, setRecipients] = useState<string[]>([""]);

  const { data: report, isLoading } = trpc.reports.getById.useQuery({ id });

  const updateReport = trpc.reports.update.useMutation({
    onSuccess: () => {
      toast({ title: "Schedule updated" });
      router.push(`/reports/${id}`);
    },
    onError: (err) => toast({ title: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (report) {
      setIsScheduled(report.isScheduled);
      setFrequency(report.scheduleFrequency || "weekly");
      const r = report.scheduleRecipients ? JSON.parse(report.scheduleRecipients) : [""];
      setRecipients(r.length > 0 ? r : [""]);
    }
  }, [report]);

  const addRecipient = () => setRecipients([...recipients, ""]);

  const removeRecipient = (index: number) => {
    if (recipients.length === 1) return;
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, value: string) => {
    setRecipients(recipients.map((r, i) => (i === index ? value : r)));
  };

  const handleSave = () => {
    const validRecipients = recipients.filter((r) => r.trim());
    if (isScheduled && validRecipients.length === 0) {
      toast({ title: "Add at least one recipient", variant: "destructive" });
      return;
    }

    updateReport.mutate({
      id,
      isScheduled,
      scheduleFrequency: isScheduled ? frequency : null,
      scheduleRecipients: isScheduled ? JSON.stringify(validRecipients) : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/reports/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Schedule Report</h1>
          <p className="text-sm text-gray-500">{report?.name}</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50">
              <CalendarClock className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Automated Schedule</p>
              <p className="text-sm text-gray-500">Automatically run and email this report</p>
            </div>
          </div>
          <button
            onClick={() => setIsScheduled(!isScheduled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isScheduled ? "bg-blue-500" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isScheduled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {isScheduled && (
        <>
          {/* Frequency */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Frequency</h2>
            <div>
              <Label>Run every</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="mt-1 w-full max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Day (9:00 AM UTC)</SelectItem>
                  <SelectItem value="weekly">Week (Monday, 9:00 AM UTC)</SelectItem>
                  <SelectItem value="monthly">Month (1st, 9:00 AM UTC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-gray-400">
              {frequency === "daily" && "Report will run every day at 9:00 AM UTC"}
              {frequency === "weekly" && "Report will run every Monday at 9:00 AM UTC"}
              {frequency === "monthly" && "Report will run on the 1st of each month at 9:00 AM UTC"}
            </p>
          </div>

          {/* Recipients */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Recipients</h2>
              </div>
              <Button variant="outline" size="sm" onClick={addRecipient}>
                <Plus className="mr-1.5 h-3 w-3" />Add
              </Button>
            </div>
            <div className="space-y-2">
              {recipients.map((email, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => updateRecipient(i, e.target.value)}
                    placeholder="email@example.com"
                    className="flex-1"
                  />
                  {recipients.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeRecipient(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Save */}
      <div className="flex gap-3">
        <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleSave} disabled={updateReport.isPending}>
          {updateReport.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Schedule
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/reports/${id}`}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
