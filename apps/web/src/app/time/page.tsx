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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Clock, DollarSign, TrendingUp } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}.${Math.round(mins / 6)}h`;
}

function formatDurationLong(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function TimeEntriesPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.timeEntries.list.useQuery({});
  const { data: summary } = trpc.timeEntries.summary.useQuery({});

  const deleteEntry = trpc.timeEntries.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Time entry deleted" });
      utils.timeEntries.list.invalidate();
      utils.timeEntries.summary.invalidate();
    },
  });

  const filteredEntries = data?.timeEntries.filter(
    (entry) =>
      !search ||
      entry.description.toLowerCase().includes(search.toLowerCase()) ||
      entry.matter.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.matter.client.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Time Tracking</h1>
          <p className="text-gray-500 mt-1">Track and manage billable hours</p>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-600 shadow-sm">
          <Link href="/time/new">
            <Plus className="mr-2 h-4 w-4" />
            Log Time
          </Link>
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Hours</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatDuration(summary?.totalMinutes || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">All time entries</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Billable Hours</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatDuration(summary?.billableMinutes || 0)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span className="text-xs text-emerald-600">
                  {summary?.totalMinutes ? Math.round((summary?.billableMinutes || 0) / summary.totalMinutes * 100) : 0}% billable
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Entries</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{summary?.entryCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Time records</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by description, matter, or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="font-semibold text-gray-600">Date</TableHead>
              <TableHead className="font-semibold text-gray-600">Description</TableHead>
              <TableHead className="font-semibold text-gray-600">Matter</TableHead>
              <TableHead className="font-semibold text-gray-600">Duration</TableHead>
              <TableHead className="font-semibold text-gray-600">Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <p className="text-gray-500 mt-3">Loading time entries...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredEntries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No time entries found</p>
                  <p className="text-gray-400 text-sm mt-1">Start tracking your billable hours</p>
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/time/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Log Time
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries?.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-gray-50/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-gray-700">
                          {new Date(entry.date).getDate()}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase">
                          {new Date(entry.date).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px]">
                      <p className="text-gray-900 truncate">{entry.description}</p>
                      <p className="text-sm text-gray-500">{entry.matter.client.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={"/matters/" + entry.matter.id}
                      className="text-gray-600 hover:text-blue-600"
                    >
                      {entry.matter.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-gray-900">
                      {formatDurationLong(entry.duration)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {entry.billable ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                        Billable
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Non-billable
                      </span>
                    )}
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
                          <Link href={"/time/" + entry.id + "/edit"}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteEntry.mutate({ id: entry.id })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
