"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, MoreHorizontal, Pencil, Trash2, Calendar as CalendarIcon, MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CalendarPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.calendar.list.useQuery({});
  const { data: upcoming } = trpc.calendar.upcoming.useQuery({ limit: 5 });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Event deleted" });
      utils.calendar.list.invalidate();
      utils.calendar.upcoming.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Manage your schedule and deadlines</p>
        </div>
        <Button asChild>
          <Link href="/calendar/new">
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>All Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Matter</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : data?.events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        No events found
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Link
                            href={"/calendar/" + event.id}
                            className="font-medium hover:underline"
                          >
                            {event.title}
                          </Link>
                          {event.allDay && (
                            <Badge variant="secondary" className="ml-2">
                              All Day
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.allDay
                            ? formatDate(event.startTime)
                            : formatDateTime(event.startTime)}
                        </TableCell>
                        <TableCell>
                          {event.matter ? (
                            <Link
                              href={"/matters/" + event.matter.id}
                              className="hover:underline"
                            >
                              {event.matter.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.location || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={"/calendar/" + event.id + "/edit"}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteEvent.mutate({ id: event.id })}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming?.length === 0 ? (
              <p className="text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="space-y-4">
                {upcoming?.map((event) => (
                  <div key={event.id} className="flex gap-3 p-3 rounded-lg border">
                    <div className="flex-shrink-0">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={"/calendar/" + event.id}
                        className="font-medium hover:underline block truncate"
                      >
                        {event.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {event.allDay
                          ? formatDate(event.startTime)
                          : formatDateTime(event.startTime)}
                      </p>
                      {event.matter && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.matter.matterNumber}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
