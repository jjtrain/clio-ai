"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Edit, Trash2, MapPin, Clock, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;

  const { data: event, isLoading } = trpc.calendar.getById.useQuery({ id: eventId });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Event deleted" });
      router.push("/calendar");
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!event) {
    return <div>Event not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/calendar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{event.title}</h1>
              {event.allDay && <Badge variant="secondary">All Day</Badge>}
            </div>
            <p className="text-muted-foreground">
              {event.allDay
                ? formatDate(event.startTime)
                : formatDateTime(event.startTime)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={"/calendar/" + eventId + "/edit"}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this event?")) {
                deleteEvent.mutate({ id: eventId });
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Date & Time</p>
                {event.allDay ? (
                  <p className="text-muted-foreground">
                    {formatDate(event.startTime)}
                    {event.startTime !== event.endTime &&
                      " - " + formatDate(event.endTime)}
                    {" (All day)"}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {formatDateTime(event.startTime)}
                    <br />
                    to {formatTime(event.endTime)}
                  </p>
                )}
              </div>
            </div>

            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Location</p>
                  <p className="text-muted-foreground">{event.location}</p>
                </div>
              </div>
            )}

            {event.description && (
              <div>
                <p className="font-medium mb-1">Description</p>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {event.matter && (
          <Card>
            <CardHeader>
              <CardTitle>Associated Matter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Matter</p>
                <Link
                  href={"/matters/" + event.matter.id}
                  className="hover:underline"
                >
                  {event.matter.matterNumber} - {event.matter.name}
                </Link>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Client</p>
                <Link
                  href={"/clients/" + event.matter.client.id}
                  className="hover:underline"
                >
                  {event.matter.client.name}
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
