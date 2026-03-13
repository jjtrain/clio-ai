"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, PenTool, Send, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  PENDING_CLIENT: { label: "Awaiting Client", variant: "outline", className: "border-amber-300 bg-amber-50 text-amber-700" },
  CLIENT_SIGNED: { label: "Client Signed", variant: "outline", className: "border-blue-300 bg-blue-50 text-blue-700" },
  PENDING_ATTORNEY: { label: "Awaiting Attorney", variant: "outline", className: "border-purple-300 bg-purple-50 text-purple-700" },
  COMPLETED: { label: "Completed", variant: "outline", className: "border-green-300 bg-green-50 text-green-700" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  EXPIRED: { label: "Expired", variant: "secondary" },
};

export default function SignaturesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = trpc.signatures.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter as any,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">E-Signatures</h1>
          <p className="text-muted-foreground">Send and track document signatures</p>
        </div>
        <Button asChild>
          <Link href="/signatures/new">
            <Plus className="mr-2 h-4 w-4" />
            New Signature Request
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PENDING_CLIENT">Awaiting Client</SelectItem>
            <SelectItem value="CLIENT_SIGNED">Client Signed</SelectItem>
            <SelectItem value="PENDING_ATTORNEY">Awaiting Attorney</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Matter</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <PenTool className="h-8 w-8 text-gray-300" />
                    <p className="text-gray-500">No signature requests found</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/signatures/new">Create your first</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.requests.map((req) => {
                const config = statusConfig[req.status] || statusConfig.DRAFT;
                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <Link
                        href={`/signatures/${req.id}`}
                        className="font-medium hover:underline"
                      >
                        {req.title}
                      </Link>
                    </TableCell>
                    <TableCell>{req.clientName}</TableCell>
                    <TableCell>
                      {req.matter ? (
                        <Link href={`/matters/${req.matter.id}`} className="hover:underline text-sm">
                          {req.matter.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className={config.className}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {req.sentAt ? formatDate(req.sentAt) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/signatures/${req.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
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
