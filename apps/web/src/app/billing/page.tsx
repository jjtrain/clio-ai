"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  FileText,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Send,
} from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.invoices.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const { data: summary } = trpc.invoices.summary.useQuery();

  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => {
      toast({ title: "Invoice status updated" });
      utils.invoices.list.invalidate();
      utils.invoices.summary.invalidate();
    },
  });

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-600";
      case "SENT":
        return "bg-blue-100 text-blue-700";
      case "PAID":
        return "bg-emerald-100 text-emerald-700";
      case "OVERDUE":
        return "bg-red-100 text-red-700";
      case "CANCELLED":
        return "bg-gray-100 text-gray-500";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <FileText className="h-3 w-3" />;
      case "SENT":
        return <Send className="h-3 w-3" />;
      case "PAID":
        return <CheckCircle className="h-3 w-3" />;
      case "OVERDUE":
        return <AlertCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const filteredInvoices = data?.invoices.filter(
    (invoice) =>
      !search ||
      invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      invoice.matter.name.toLowerCase().includes(search.toLowerCase()) ||
      invoice.matter.client.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Billing & Invoicing</h1>
          <p className="text-gray-500 mt-1">Manage invoices and track payments</p>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-600 shadow-sm">
          <Link href="/billing/new">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Outstanding</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(summary?.totalOutstanding || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{summary?.sentCount || 0} invoices sent</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Overdue</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(summary?.totalOverdue || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{summary?.overdueCount || 0} invoices</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Draft Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.draftCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Ready to send</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-100">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Sent Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.sentCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting payment</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50">
              <Clock className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by invoice number, matter, or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-white border-gray-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="font-semibold text-gray-600">Invoice</TableHead>
              <TableHead className="font-semibold text-gray-600">Client / Matter</TableHead>
              <TableHead className="font-semibold text-gray-600">Issue Date</TableHead>
              <TableHead className="font-semibold text-gray-600">Due Date</TableHead>
              <TableHead className="font-semibold text-gray-600">Amount</TableHead>
              <TableHead className="font-semibold text-gray-600">Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <p className="text-gray-500 mt-3">Loading invoices...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredInvoices?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No invoices found</p>
                  <p className="text-gray-400 text-sm mt-1">Create your first invoice to get started</p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/billing/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Invoice
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices?.map((invoice) => {
                const balance = parseFloat(invoice.total.toString()) - parseFloat(invoice.amountPaid.toString());
                return (
                  <TableRow key={invoice.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <Link href={"/billing/" + invoice.id} className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900 hover:text-blue-600 font-mono">
                          {invoice.invoiceNumber}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{invoice.matter.client.name}</p>
                        <p className="text-sm text-gray-500">{invoice.matter.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatDate(invoice.issueDate)}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatDate(invoice.dueDate)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</p>
                        {balance > 0 && invoice.status !== "DRAFT" && (
                          <p className="text-xs text-gray-500">
                            Balance: {formatCurrency(balance)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(
                          invoice.status
                        )}`}
                      >
                        {getStatusIcon(invoice.status)}
                        {invoice.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={"/billing/" + invoice.id}>View Details</Link>
                          </DropdownMenuItem>
                          {invoice.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatus.mutate({ id: invoice.id, status: "SENT" })
                              }
                            >
                              <Send className="mr-2 h-4 w-4" />
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {invoice.status === "SENT" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatus.mutate({ id: invoice.id, status: "PAID" })
                              }
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
