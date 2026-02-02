"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

export default function EditTimeEntryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const entryId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [billable, setBillable] = useState(true);

  const { data: entry, isLoading } = trpc.timeEntries.getById.useQuery({ id: entryId });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (entry) {
      const h = Math.floor(entry.duration / 60);
      const m = entry.duration % 60;
      setHours(h.toString());
      setMinutes(m.toString());
      setBillable(entry.billable);
    }
  }, [entry]);

  const updateEntry = trpc.timeEntries.update.useMutation({
    onSuccess: () => {
      toast({ title: "Time entry updated successfully" });
      utils.timeEntries.list.invalidate();
      router.push("/time");
    },
    onError: (error) => {
      toast({
        title: "Failed to update time entry",
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

    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

    if (totalMinutes < 1) {
      toast({
        title: "Invalid duration",
        description: "Duration must be at least 1 minute",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    updateEntry.mutate({
      id: entryId,
      data: {
        description: formData.get("description") as string,
        duration: totalMinutes,
        date: formData.get("date") as string,
        billable,
        rate: formData.get("rate") ? parseFloat(formData.get("rate") as string) : undefined,
      },
    });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!entry) {
    return <div>Time entry not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/time">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Time Entry</h1>
          <p className="text-muted-foreground">Update time entry details</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Time Entry Details</CardTitle>
          <CardDescription>
            Matter: {entry.matter.matterNumber} - {entry.matter.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Matter</Label>
              <Input value={`${entry.matter.matterNumber} - ${entry.matter.name}`} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={new Date(entry.date).toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration *</Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                required
                defaultValue={entry.description}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="billable"
                  checked={billable}
                  onChange={(e) => setBillable(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="billable" className="font-normal">
                  Billable
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Hourly Rate (optional)</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                defaultValue={entry.rate?.toString() || ""}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/time">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
