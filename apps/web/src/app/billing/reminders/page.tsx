"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Bell,
  Settings,
  CalendarClock,
  DollarSign,
  AlertCircle,
  BarChart3,
  CreditCard,
  Plus,
  Send,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

const reminderTypeBadge: Record<string, { label: string; className: string }> = {
  UPCOMING_DUE: { label: "Upcoming", className: "bg-blue-100 text-blue-700" },
  DUE_TODAY: { label: "Due Today", className: "bg-amber-100 text-amber-700" },
  PAST_DUE_3: { label: "3 Days", className: "bg-orange-100 text-orange-700" },
  PAST_DUE_7: { label: "7 Days", className: "bg-orange-100 text-orange-700" },
  PAST_DUE_14: { label: "14 Days", className: "bg-red-100 text-red-700" },
  PAST_DUE_30: { label: "30 Days", className: "bg-red-100 text-red-700" },
  PAST_DUE_60: { label: "60 Days", className: "bg-red-200 text-red-800" },
  PAST_DUE_90: { label: "90 Days", className: "bg-red-200 text-red-800" },
  CUSTOM: { label: "Custom", className: "bg-gray-100 text-gray-700" },
};

const methodBadge: Record<string, { label: string; className: string }> = {
  EMAIL: { label: "Email", className: "bg-blue-50 text-blue-600" },
  TEXT: { label: "Text", className: "bg-green-50 text-green-600" },
  BOTH: { label: "Both", className: "bg-purple-50 text-purple-600" },
};

const statusStyles: Record<string, string> = {
  SCHEDULED: "bg-amber-100 text-amber-700",
  SENT: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const planStatusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  DEFAULTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function BillRemindersPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState("reminders");

  const { data: stats } = trpc.billingReminders.getStats.useQuery();
  const { data: reminders, isLoading: loadingReminders } = trpc.billingReminders.listReminders.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const { data: plans, isLoading: loadingPlans } = trpc.billingReminders.listPaymentPlans.useQuery();

  const bulkSchedule = trpc.billingReminders.bulkAutoSchedule.useMutation({
    onSuccess: (data) => {
      toast({ title: `Scheduled reminders for ${data.count} invoices` });
      utils.billingReminders.listReminders.invalidate();
    },
  });

  const cancelReminder = trpc.billingReminders.cancelReminder.useMutation({
    onSuccess: () => {
      toast({ title: "Reminder cancelled" });
      utils.billingReminders.listReminders.invalidate();
    },
  });

  const sendReminder = trpc.billingReminders.sendReminder.useMutation({
    onSuccess: () => {
      toast({ title: "Reminder sent" });
      utils.billingReminders.listReminders.invalidate();
      utils.billingReminders.getStats.invalidate();
    },
    onError: (err) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Bill Reminders & Collections</h1>
            <p className="text-gray-500 text-sm">Automated payment reminders and payment plans</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/billing/reminders/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button
            onClick={() => bulkSchedule.mutate()}
            disabled={bulkSchedule.isLoading}
          >
            {bulkSchedule.isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarClock className="mr-2 h-4 w-4" />
            )}
            Schedule for All Overdue
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold">{formatCurrency(stats?.totalOutstanding || 0)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue Invoices</p>
                <p className="text-xl font-bold text-red-600">{stats?.overdueInvoices || 0}</p>
              </div>
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Reminders Sent</p>
                <p className="text-xl font-bold">{stats?.remindersSent || 0}</p>
              </div>
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Collection Rate</p>
                <p className="text-xl font-bold text-emerald-600">{stats?.collectionRate || 0}%</p>
              </div>
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Payment Plans</p>
                <p className="text-xl font-bold">{stats?.activePlans || 0}</p>
              </div>
              <CreditCard className="h-5 w-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="reminders">Scheduled Reminders</TabsTrigger>
          <TabsTrigger value="plans">Payment Plans</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReminders ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : !reminders || reminders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Bell className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-muted-foreground">No reminders found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  reminders.map((r: any) => {
                    const balance = parseFloat(r.invoice.total.toString()) - parseFloat(r.invoice.amountPaid.toString());
                    const type = reminderTypeBadge[r.type] || reminderTypeBadge.CUSTOM;
                    const method = methodBadge[r.method] || methodBadge.EMAIL;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/billing/${r.invoice.id}`} className="font-mono text-sm hover:underline">
                            {r.invoice.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{r.invoice.matter.client.name}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(balance)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${type.className}`}>
                            {type.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${method.className}`}>
                            {method.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(r.scheduledFor)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyles[r.status]}`}>
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {r.status === "SCHEDULED" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => sendReminder.mutate({ reminderId: r.id })}
                                  title="Send now"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-gray-400"
                                  onClick={() => cancelReminder.mutate({ id: r.id })}
                                  title="Cancel"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Payment Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button asChild>
              <Link href="/billing/reminders/plans/new">
                <Plus className="mr-2 h-4 w-4" />
                New Payment Plan
              </Link>
            </Button>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead>Client</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPlans ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : !plans || plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-muted-foreground">No payment plans</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan: any) => {
                    const progress = plan.installmentCount > 0
                      ? Math.round((plan.installmentsPaid / plan.installmentCount) * 100)
                      : 0;
                    return (
                      <TableRow key={plan.id} className="cursor-pointer hover:bg-gray-50">
                        <TableCell>
                          <Link href={`/billing/reminders/plans/${plan.id}`} className="font-medium hover:underline">
                            {plan.client.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/billing/${plan.invoice.id}`} className="font-mono text-sm hover:underline">
                            {plan.invoice.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(Number(plan.totalAmount))}</TableCell>
                        <TableCell>{formatCurrency(Number(plan.installmentAmount))}</TableCell>
                        <TableCell className="text-sm capitalize">{plan.frequency.toLowerCase()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {plan.installmentsPaid}/{plan.installmentCount}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {plan.nextDueDate ? formatDate(plan.nextDueDate) : "-"}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${planStatusStyles[plan.status]}`}>
                            {plan.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            {!reminders ? (
              <p className="text-center text-muted-foreground py-6">Loading...</p>
            ) : (
              <div className="space-y-3">
                {reminders
                  .filter((r: any) => r.status === "SENT")
                  .slice(0, 50)
                  .map((r: any) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {reminderTypeBadge[r.type]?.label || r.type} reminder sent for #{r.invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.invoice.matter.client.name} · {r.method} · {formatDate(r.sentAt || r.scheduledFor)}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(parseFloat(r.invoice.total.toString()) - parseFloat(r.invoice.amountPaid.toString()))}
                      </span>
                    </div>
                  ))}
                {reminders.filter((r: any) => r.status === "SENT").length === 0 && (
                  <div className="text-center py-8">
                    <Clock className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-muted-foreground">No reminders sent yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
