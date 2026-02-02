"use client";

import { useRouter } from "next/navigation";
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
import Link from "next/link";
import { useState } from "react";

// Temporary user ID until auth is implemented
const TEMP_USER_ID = "temp-user-id";

export default function NewTimeEntryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [billable, setBillable] = useState(true);

  const { data: mattersData } = trpc.matters.list.useQuery({ status: "OPEN" });

  const createEntry = trpc.timeEntries.create.useMutation({
    onSuccess: () => {
      toast({ title: "Time entry created successfully" });
      router.push("/time");
    },
    onError: (error) => {
      toast({
        title: "Failed to create time entry",
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

    createEntry.mutate({
      matterId: selectedMatterId,
      userId: TEMP_USER_ID,
      description: formData.get("description") as string,
      duration: totalMinutes,
      date: formData.get("date") as string,
      billable,
      rate: formData.get("rate") ? parseFloat(formData.get("rate") as string) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/time">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Time Entry</h1>
          <p className="text-muted-foreground">Record your billable time</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Time Entry Details</CardTitle>
          <CardDescription>Enter the details for the time entry</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matter">Matter *</Label>
              <Select
                value={selectedMatterId}
                onValueChange={setSelectedMatterId}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a matter" />
                </SelectTrigger>
                <SelectContent>
                  {mattersData?.matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.matterNumber} - {matter.name} ({matter.client.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
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
              <Textarea id="description" name="description" rows={4} required />
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
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting || !selectedMatterId}>
                {isSubmitting ? "Creating..." : "Create Entry"}
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
