"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, FileText, Clock } from "lucide-react";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMatterId = searchParams.get("matterId") || "";
  const { toast } = useToast();

  const [matterId, setMatterId] = useState(initialMatterId);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split("T")[0];
  });
  const [taxRate, setTaxRate] = useState("0");
  const [defaultRate, setDefaultRate] = useState("450");
  const [notes, setNotes] = useState("");

  const { data: mattersData } = trpc.matters.list.useQuery({});
  const { data: timeEntries, isLoading: entriesLoading } = trpc.invoices.getUnbilledTimeEntries.useQuery(
    { matterId },
    { enabled: !!matterId }
  );

  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: (invoice) => {
      toast({ title: "Invoice created successfully" });
      router.push("/billing/" + invoice.id);
    },
    onError: (error) => {
      toast({ title: "Error creating invoice", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectAll = () => {
    if (timeEntries && selectedEntries.length === timeEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(timeEntries?.map((e) => e.id) || []);
    }
  };

  const handleToggleEntry = (id: string) => {
    setSelectedEntries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const calculateTotals = () => {
    if (!timeEntries) return { subtotal: 0, tax: 0, total: 0 };

    const selected = timeEntries.filter((e) => selectedEntries.includes(e.id));
    let subtotal = 0;

    for (const entry of selected) {
      const hours = entry.duration / 60;
      const rate = entry.rate ? parseFloat(entry.rate.toString()) : parseFloat(defaultRate);
      subtotal += hours * rate;
    }

    const tax = subtotal * (parseFloat(taxRate) / 100);
    const total = subtotal + tax;

    return { subtotal, tax, total };
  };

  const totals = calculateTotals();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!matterId) {
      toast({ title: "Please select a matter", variant: "destructive" });
      return;
    }

    if (selectedEntries.length === 0) {
      toast({ title: "Please select at least one time entry", variant: "destructive" });
      return;
    }

    createInvoice.mutate({
      matterId,
      timeEntryIds: selectedEntries,
      dueDate,
      taxRate: parseFloat(taxRate),
      defaultRate: parseFloat(defaultRate),
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/billing">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Create Invoice</h1>
          <p className="text-gray-500 mt-1">Generate an invoice from unbilled time entries</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Settings */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Matter</Label>
              <Select value={matterId} onValueChange={setMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a matter" />
                </SelectTrigger>
                <SelectContent>
                  {mattersData?.matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.client.name} - {matter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Hourly Rate ($)</Label>
              <Input
                type="number"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, instructions, etc."
            />
          </div>
        </div>

        {/* Time Entries Selection */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Unbilled Time Entries</h2>
            {timeEntries && timeEntries.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedEntries.length === timeEntries.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>

          {!matterId ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select a matter to view unbilled time entries</p>
            </div>
          ) : entriesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-3">Loading time entries...</p>
            </div>
          ) : timeEntries?.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No unbilled time entries for this matter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {timeEntries?.map((entry) => {
                const hours = entry.duration / 60;
                const rate = entry.rate ? parseFloat(entry.rate.toString()) : parseFloat(defaultRate);
                const amount = hours * rate;

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      selectedEntries.includes(entry.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedEntries.includes(entry.id)}
                      onCheckedChange={() => handleToggleEntry(entry.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{entry.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(entry.date).toLocaleDateString()} • {entry.user.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatDuration(entry.duration)}</p>
                      <p className="text-sm text-gray-500">@ {formatCurrency(rate)}/hr</p>
                    </div>
                    <div className="text-right w-24">
                      <p className="font-semibold text-gray-900">{formatCurrency(amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totals */}
        {selectedEntries.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({selectedEntries.length} items)</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {parseFloat(taxRate) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatCurrency(totals.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/billing">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600"
            disabled={createInvoice.isLoading || selectedEntries.length === 0}
          >
            {createInvoice.isLoading ? "Creating..." : "Create Invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <NewInvoiceForm />
    </Suspense>
  );
}
