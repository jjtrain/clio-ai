"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [allDay, setAllDay] = useState(false);

  const { data: event, isLoading } = trpc.calendar.getById.useQuery({ id: eventId });
  const { data: mattersData } = trpc.matters.list.useQuery({ status: "OPEN" });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (event) {
      setSelectedMatterId(event.matterId || "");
      setAllDay(event.allDay);
    }
  }, [event]);

  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: () => {
      toast({ title: "Event updated successfully" });
      utils.calendar.getById.invalidate({ id: eventId });
      router.push("/calendar/" + eventId);
    },
    onError: (error) => {
      toast({
        title: "Failed to update event",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const startDateVal = formData.get("startDate") as string;
    const startTimeVal = formData.get("startTime") as string;
    const endDateVal = formData.get("endDate") as string;
    const endTimeVal = formData.get("endTime") as string;

    let startDateTime = allDay
      ? startDateVal + "T00:00:00"
      : startDateVal + "T" + (startTimeVal || "09:00");
    let endDateTime = allDay
      ? (endDateVal || startDateVal) + "T23:59:59"
      : (endDateVal || startDateVal) + "T" + (endTimeVal || "10:00");

    updateEvent.mutate({
      id: eventId,
      data: {
        matterId: selectedMatterId || undefined,
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        startTime: startDateTime,
        endTime: endDateTime,
        allDay,
        location: formData.get("location") as string,
      },
    });
  };

  if (isLoading) return <div>Loading...</div>;
  if (!event) return <div>Event not found</div>;

  const startDate = new Date(event.startTime).toISOString().split("T")[0];
  const startTimeDefault = new Date(event.startTime).toTimeString().slice(0, 5);
  const endDate = new Date(event.endTime).toISOString().split("T")[0];
  const endTimeDefault = new Date(event.endTime).toTimeString().slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={"/calendar/" + eventId}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Event</h1>
          <p className="text-muted-foreground">Update event details</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>Update the event information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required defaultValue={event.title} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="matter">Matter (optional)</Label>
              <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a matter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No matter</SelectItem>
                  {mattersData?.matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.matterNumber} - {matter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="allDay" className="font-normal">All day event</Label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" name="startDate" type="date" required defaultValue={startDate} />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input id="startTime" name="startTime" type="time" defaultValue={startTimeDefault} />
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={endDate} />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input id="endTime" name="endTime" type="time" defaultValue={endTimeDefault} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" defaultValue={event.location || ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={event.description || ""} />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={"/calendar/" + eventId}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
