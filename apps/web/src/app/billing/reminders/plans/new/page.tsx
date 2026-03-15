"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

export default function NewPaymentPlanPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: invoicesData } = trpc.invoices.list.useQuery({ status: undefined });

  const unpaidInvoices = invoicesData?.invoices.filter(
    (inv: any) => inv.status === "SENT" || inv.status === "OVERDUE"
  ) || [];

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [installmentCount, setInstallmentCount] = useState(3);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [customAmount, setCustomAmount] = useState("");
  const [notes, setNotes] = useState("");

  const selectedInvoice = unpaidInvoices.find((inv: any) => inv.id === selectedInvoiceId);
  const balance = selectedInvoice
    ? parseFloat(selectedInvoice.total.toString()) - parseFloat(selectedInvoice.amountPaid.toString())
    : 0;
  const installmentAmount = customAmount
    ? parseFloat(customAmount)
    : installmentCount > 0
    ? Math.round((balance / installmentCount) * 100) / 100
    : 0;

  const schedule = useMemo(() => {
    if (!selectedInvoice || installmentCount <= 0) return [];
    const start = new Date(startDate);
    const items = [];
    for (let i = 0; i < installmentCount; i++) {
      const dueDate = new Date(start);
      switch (frequency) {
        case "WEEKLY":
          dueDate.setDate(dueDate.getDate() + 7 * i);
          break;
        case "BIWEEKLY":
          dueDate.setDate(dueDate.getDate() + 14 * i);
          break;
        case "MONTHLY":
          dueDate.setMonth(dueDate.getMonth() + i);
          break;
      }
      const isLast = i === installmentCount - 1;
      const amount = isLast
        ? Math.round((balance - installmentAmount * (installmentCount - 1)) * 100) / 100
        : installmentAmount;
      items.push({ number: i + 1, dueDate, amount: Math.max(0, amount) });
    }
    return items;
  }, [selectedInvoice, installmentCount, frequency, startDate, installmentAmount, balance]);

  const createPlan = trpc.billingReminders.createPaymentPlan.useMutation({
    onSuccess: (data) => {
      toast({ title: "Payment plan created" });
      router.push(`/billing/reminders/plans/${data.id}`);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    createPlan.mutate({
      invoiceId: selectedInvoiceId,
      clientId: selectedInvoice.matter.client.id,
      totalAmount: balance,
      installmentAmount,
      frequency,
      startDate,
      installmentCount,
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/billing/reminders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Create Payment Plan</h1>
          <p className="text-gray-500 text-sm">Set up installment payments for an invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice & Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an unpaid invoice" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map((inv: any) => {
                    const bal = parseFloat(inv.total.toString()) - parseFloat(inv.amountPaid.toString());
                    return (
                      <SelectItem key={inv.id} value={inv.id}>
                        #{inv.invoiceNumber} - {inv.matter.client.name} ({formatCurrency(bal)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedInvoice && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Client: {selectedInvoice.matter.client.name}
                </p>
                <p className="text-sm text-blue-700">
                  Matter: {selectedInvoice.matter.name}
                </p>
                <p className="text-sm text-blue-700">
                  Balance Due: <strong>{formatCurrency(balance)}</strong>
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Number of Installments</Label>
                <Input
                  type="number"
                  min={2}
                  max={24}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(parseInt(e.target.value) || 2)}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="BIWEEKLY">Biweekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Installment Amount (override)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={formatCurrency(installmentAmount)}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Auto: {formatCurrency(balance / (installmentCount || 1))} per installment
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the payment plan"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Schedule Preview */}
        {schedule.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Schedule Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((item) => (
                    <TableRow key={item.number}>
                      <TableCell className="font-medium">{item.number}</TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={2} className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(schedule.reduce((sum, i) => sum + i.amount, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/billing/reminders">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={!selectedInvoiceId || createPlan.isLoading}
          >
            {createPlan.isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Create Payment Plan
          </Button>
        </div>
      </form>
    </div>
  );
}
