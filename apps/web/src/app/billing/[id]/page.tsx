"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useHelcim } from "@/lib/use-helcim";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Printer,
  Plus,
  CreditCard,
  Building2,
  Mail,
  Phone,
  MapPin,
  Trash2,
  Globe,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function formatHours(hours: number | string): string {
  const num = typeof hours === "string" ? parseFloat(hours) : hours;
  return num.toFixed(2);
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery(
    { id: params.id as string },
    { enabled: !!params.id }
  );

  const { data: firmInfo } = trpc.users.getFirmInfo.useQuery();

  const { data: helcimStatus } = trpc.invoices.helcimEnabled.useQuery();

  const initHelcimCheckout = trpc.invoices.initializeHelcimCheckout.useMutation({
    onError: (error) => {
      toast({ title: "Failed to initialize payment", description: error.message, variant: "destructive" });
    },
  });

  const confirmHelcimPayment = trpc.invoices.confirmHelcimPayment.useMutation({
    onSuccess: () => {
      toast({ title: "Payment successful", description: "Your online payment has been recorded." });
      utils.invoices.getById.invalidate();
      utils.invoices.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Payment verification failed", description: error.message, variant: "destructive" });
    },
  });

  const { isScriptLoaded, openCheckout, isProcessing } = useHelcim({
    onSuccess: (result) => {
      if (!invoice) return;
      confirmHelcimPayment.mutate({
        invoiceId: invoice.id,
        transactionId: result.transactionId,
        approvalCode: result.approvalCode,
        cardType: result.cardType,
        amount: result.amount,
        hash: result.hash,
        rawResponse: result.rawResponse,
      });
    },
    onError: (error) => {
      toast({ title: "Payment error", description: error, variant: "destructive" });
    },
  });

  const handlePayOnline = async () => {
    if (!invoice) return;
    const result = await initHelcimCheckout.mutateAsync({ invoiceId: invoice.id });
    openCheckout(result.checkoutToken);
  };

  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => {
      toast({ title: "Invoice status updated" });
      utils.invoices.getById.invalidate();
      utils.invoices.list.invalidate();
    },
  });

  const addPayment = trpc.invoices.addPayment.useMutation({
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      utils.invoices.getById.invalidate();
      utils.invoices.list.invalidate();
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
    },
    onError: (error) => {
      toast({ title: "Error recording payment", description: error.message, variant: "destructive" });
    },
  });

  const deleteInvoice = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Invoice deleted" });
      router.push("/billing");
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    addPayment.mutate({
      invoiceId: invoice.id,
      amount: parseFloat(paymentAmount),
      paymentDate,
      paymentMethod: paymentMethod as any,
      reference: paymentReference || undefined,
      notes: paymentNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Invoice not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/billing">Back to Billing</Link>
        </Button>
      </div>
    );
  }

  const balance = parseFloat(invoice.total.toString()) - parseFloat(invoice.amountPaid.toString());

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "DRAFT": return "bg-gray-100 text-gray-600";
      case "SENT": return "bg-blue-100 text-blue-700";
      case "PAID": return "bg-emerald-100 text-emerald-700";
      case "OVERDUE": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header - Hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
            <p className="text-gray-500 mt-1">
              {invoice.matter.client.name} • {invoice.matter.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
          {invoice.status === "DRAFT" && (
            <>
              <Button
                variant="outline"
                onClick={() => updateStatus.mutate({ id: invoice.id, status: "SENT" })}
              >
                <Send className="mr-2 h-4 w-4" />
                Mark as Sent
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this invoice?")) {
                    deleteInvoice.mutate({ id: invoice.id });
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {(invoice.status === "SENT" || invoice.status === "OVERDUE") && (
            <>
            {helcimStatus?.enabled && (
              <Button
                className="bg-blue-500 hover:bg-blue-600"
                onClick={handlePayOnline}
                disabled={isProcessing || initHelcimCheckout.isLoading || confirmHelcimPayment.isLoading || !isScriptLoaded}
              >
                <Globe className="mr-2 h-4 w-4" />
                {initHelcimCheckout.isLoading
                  ? "Initializing..."
                  : isProcessing
                  ? "Processing..."
                  : confirmHelcimPayment.isLoading
                  ? "Confirming..."
                  : "Pay Online"}
              </Button>
            )}
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600">
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={formatCurrency(balance)}
                      min="0.01"
                      max={balance}
                      step="0.01"
                      required
                    />
                    <p className="text-sm text-gray-500">Balance due: {formatCurrency(balance)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="CHECK">Check</SelectItem>
                        <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference (optional)</Label>
                    <Input
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Check number, transaction ID, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Input
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Additional notes"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addPayment.isLoading}>
                      {addPayment.isLoading ? "Recording..." : "Record Payment"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Invoice Document */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 print:shadow-none print:border-none print:p-0">
        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-8 pb-8 border-b">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">INVOICE</h2>
            <p className="text-xl text-gray-600 mt-1 font-mono">{invoice.invoiceNumber}</p>
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold text-gray-900">
              {firmInfo?.firmName || "Your Firm Name"}
            </h3>
            <div className="text-gray-600 mt-2 space-y-1">
              {firmInfo?.address && (
                <p className="flex items-center justify-end gap-2">
                  <span>{firmInfo.address}</span>
                  <MapPin className="h-4 w-4 print:hidden" />
                </p>
              )}
              {firmInfo?.phone && (
                <p className="flex items-center justify-end gap-2">
                  <span>{firmInfo.phone}</span>
                  <Phone className="h-4 w-4 print:hidden" />
                </p>
              )}
              {firmInfo?.email && (
                <p className="flex items-center justify-end gap-2">
                  <span>{firmInfo.email}</span>
                  <Mail className="h-4 w-4 print:hidden" />
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bill To / Invoice Details */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Bill To</h4>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-gray-900">{invoice.matter.client.name}</p>
              {invoice.matter.client.address && (
                <p className="text-gray-600">{invoice.matter.client.address}</p>
              )}
              {invoice.matter.client.email && (
                <p className="text-gray-600">{invoice.matter.client.email}</p>
              )}
              {invoice.matter.client.phone && (
                <p className="text-gray-600">{invoice.matter.client.phone}</p>
              )}
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Matter</p>
              <p className="font-medium text-gray-900">{invoice.matter.name}</p>
              <p className="text-sm text-gray-500 font-mono">{invoice.matter.matterNumber}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Invoice Date</span>
              <span className="font-medium text-gray-900">{formatDate(invoice.issueDate)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Due Date</span>
              <span className="font-medium text-gray-900">{formatDate(invoice.dueDate)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Status</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
            <div className="flex justify-between py-3 bg-blue-50 rounded-lg px-3 -mx-3">
              <span className="font-semibold text-blue-900">Amount Due</span>
              <span className="text-xl font-bold text-blue-900">{formatCurrency(balance)}</span>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Services</h4>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 text-sm font-semibold text-gray-600">Description</th>
                <th className="text-right py-3 text-sm font-semibold text-gray-600 w-20">Hours</th>
                <th className="text-right py-3 text-sm font-semibold text-gray-600 w-24">Rate</th>
                <th className="text-right py-3 text-sm font-semibold text-gray-600 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-4">
                    <p className="text-gray-900">{item.description}</p>
                    {item.date && (
                      <p className="text-sm text-gray-500">{formatDate(item.date)}</p>
                    )}
                  </td>
                  <td className="text-right py-4 text-gray-900">{formatHours(Number(item.quantity))}</td>
                  <td className="text-right py-4 text-gray-900">{formatCurrency(Number(item.rate))}</td>
                  <td className="text-right py-4 font-medium text-gray-900">{formatCurrency(Number(item.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            {parseFloat(invoice.taxRate.toString()) > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Tax ({invoice.taxRate.toString()}%)</span>
                <span className="font-medium text-gray-900">{formatCurrency(Number(invoice.taxAmount))}</span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t-2 border-gray-900">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(Number(invoice.total))}</span>
            </div>
            {parseFloat(invoice.amountPaid.toString()) > 0 && (
              <>
                <div className="flex justify-between py-2 text-emerald-600">
                  <span>Amount Paid</span>
                  <span className="font-medium">-{formatCurrency(Number(invoice.amountPaid))}</span>
                </div>
                <div className="flex justify-between py-3 bg-blue-50 rounded-lg px-3 -mx-3">
                  <span className="font-bold text-blue-900">Balance Due</span>
                  <span className="font-bold text-blue-900">{formatCurrency(balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mt-8 pt-8 border-t">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
            <p className="text-gray-600">{invoice.notes}</p>
          </div>
        )}

        {/* Payment Terms */}
        <div className="mt-8 pt-8 border-t text-center text-gray-500 text-sm">
          <p>Payment is due within 30 days. Please include invoice number with your payment.</p>
          <p className="mt-1">Thank you for your business.</p>
        </div>
      </div>

      {/* Payment History - Hidden on print */}
      {invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 print:hidden">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-400" />
            Payment History
          </h3>
          <div className="space-y-3">
            {invoice.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(Number(payment.amount))} via {payment.paymentMethod.replace("_", " ")}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(payment.paymentDate)}
                    {payment.reference && ` • Ref: ${payment.reference}`}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
