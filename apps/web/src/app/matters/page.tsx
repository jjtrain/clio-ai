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
import { Plus, Search, MoreHorizontal, Briefcase, Scale } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";

export default function MattersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = trpc.matters.list.useQuery({
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
  });

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-emerald-100 text-emerald-700";
      case "CLOSED":
        return "bg-gray-100 text-gray-600";
      case "PENDING":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Matters</h1>
          <p className="text-gray-500 mt-1">Manage your legal matters and cases</p>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-600 shadow-sm">
          <Link href="/matters/new">
            <Plus className="mr-2 h-4 w-4" />
            New Matter
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by matter name or number..."
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
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="font-semibold text-gray-600">Matter</TableHead>
              <TableHead className="font-semibold text-gray-600">Client</TableHead>
              <TableHead className="font-semibold text-gray-600">Practice Area</TableHead>
              <TableHead className="font-semibold text-gray-600">Status</TableHead>
              <TableHead className="font-semibold text-gray-600">Opened</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <p className="text-gray-500 mt-3">Loading matters...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : data?.matters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No matters found</p>
                  <p className="text-gray-400 text-sm mt-1">Create your first matter to get started</p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/matters/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Matter
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              data?.matters.map((matter) => (
                <TableRow key={matter.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <Link href={"/matters/" + matter.id} className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Scale className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 hover:text-blue-600">
                          {matter.name}
                        </p>
                        <p className="text-sm text-gray-500 font-mono">
                          {matter.matterNumber}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={"/clients/" + matter.client.id}
                      className="text-gray-600 hover:text-blue-600"
                    >
                      {matter.client.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {matter.practiceArea ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-sm">
                        {matter.practiceArea}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(matter.status)}`}>
                      {matter.status === "OPEN" && (
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                      )}
                      {matter.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {formatDate(matter.openDate)}
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
                          <Link href={"/matters/" + matter.id}>View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={"/matters/" + matter.id + "/edit"}>Edit Matter</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={"/time/new?matterId=" + matter.id}>Log Time</Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
